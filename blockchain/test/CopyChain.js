import { expect } from "chai";
import hre from "hardhat";

describe("CopyChain Contracts", function () {
  let Registry;
  let registry;
  let Licensing;
  let licensing;
  let owner;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, user1, user2] = await hre.ethers.getSigners();

    Registry = await hre.ethers.getContractFactory("CopyrightRegistry");
    registry = await Registry.deploy();
    
    Licensing = await hre.ethers.getContractFactory("ContentLicensing");
    licensing = await Licensing.deploy(await registry.getAddress());
  });

  describe("CopyrightRegistry", function () {
    it("Should register content successfully", async function () {
      const hash = "hash1";
      await expect(registry.connect(user1).registerContent(hash))
        .to.emit(registry, "ContentRegistered");

      const reg = await registry.getRegistration(hash);
      expect(reg.creator).to.equal(user1.address);
      expect(reg.contentHash).to.equal(hash);
      expect(reg.isRegistered).to.be.true;
    });

    it("Should fail on duplicate hash registration", async function () {
      const hash = "hash1";
      await registry.connect(user1).registerContent(hash);
      await expect(registry.connect(user2).registerContent(hash))
        .to.be.revertedWith("Hash already registered");
    });

    it("Should register a derivative work", async function () {
      const parentHash = "hash1";
      await registry.connect(user1).registerContent(parentHash);
      const parentId = await registry.hashToContentId(parentHash);

      const derivativeHash = "hash2";
      await expect(registry.connect(user1).registerDerivative(derivativeHash, parentId))
        .to.emit(registry, "DerivativeRegistered");

      const devReg = await registry.getRegistration(derivativeHash);
      expect(devReg.parentContentId).to.equal(parentId);
    });

    it("Should fail derivative registration by unauthorized user", async function () {
      const parentHash = "hash1";
      await registry.connect(user1).registerContent(parentHash);
      const parentId = await registry.hashToContentId(parentHash);

      const derivativeHash = "hash2";
      await expect(registry.connect(user2).registerDerivative(derivativeHash, parentId))
        .to.be.revertedWith("Not authorized to register derivative");
    });
  });

  describe("ContentLicensing", function () {
    const contentHash = "hash1";
    const price = hre.ethers.parseEther("0.01");
    const terms = "Educational use; No resale";

    beforeEach(async function () {
      await registry.connect(user1).registerContent(contentHash);
    });

    it("1. Registered owner creates a licence offer successfully", async function () {
      await expect(licensing.connect(user1).createListing(contentHash, price, terms))
        .to.emit(licensing, "ListingCreated");
      
      const contentId = await registry.hashToContentId(contentHash);
      const listing = await licensing.listings(contentId);
      expect(listing.price).to.equal(price);
      expect(listing.isActive).to.be.true;
      expect(listing.terms).to.equal(terms);
      expect(await licensing.getListingCount()).to.equal(1);
    });

    it("2. An unauthorized wallet cannot create an offer for someone else's work", async function () {
      await expect(licensing.connect(user2).createListing(contentHash, price, terms))
        .to.be.revertedWith("Only creator can list for licensing");
    });

    it("3. Offer details are saved correctly and verifiable", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      const contentId = await registry.hashToContentId(contentHash);
      const listing = await licensing.listings(contentId);
      expect(listing.contentId).to.equal(contentId);
      expect(listing.price).to.equal(price);
      expect(listing.terms).to.equal(terms);
    });

    it("4. A buyer can purchase an active offer", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);

      await expect(licensing.connect(user2).purchaseLicense(contentHash, { value: price }))
        .to.emit(licensing, "LicensePurchased")
        .withArgs(await registry.hashToContentId(contentHash), user2.address, price);

      expect(await licensing.checkLicense(contentHash, user2.address)).to.be.true;
    });

    it("5. Payment goes to the intended creator recipient and excess is refunded", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);

      const excessPayment = hre.ethers.parseEther("0.02");
      await expect(() => 
        licensing.connect(user2).purchaseLicense(contentHash, { value: excessPayment })
      ).to.changeEtherBalances(
        [user1, user2],
        [price, -price] // Excess 0.01 ETH is safely refunded to user2
      );
    });

    it("6. A purchase records the correct buyer and licence terms", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      await licensing.connect(user2).purchaseLicense(contentHash, { value: price });

      const contentId = await registry.hashToContentId(contentHash);
      const license = await licensing.licensesByContent(contentId, 0);
      expect(license.licensee).to.equal(user2.address);
      expect(license.terms).to.equal(terms);
      expect(await licensing.getLicensesCount(contentId)).to.equal(1);
    });

    it("7. Creator cannot purchase their own offer", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      await expect(licensing.connect(user1).purchaseLicense(contentHash, { value: price }))
        .to.be.revertedWith("Cannot purchase own license");
    });

    it("8. An unauthorized account cannot cancel another creator's offer", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      await expect(licensing.connect(user2).cancelListing(contentHash))
        .to.be.revertedWith("Only creator can cancel listing");
    });

    it("9. Creator can cancel offer and cancelled offers cannot be purchased", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      
      await expect(licensing.connect(user1).cancelListing(contentHash))
        .to.emit(licensing, "ListingCancelled");

      const contentId = await registry.hashToContentId(contentHash);
      const listing = await licensing.listings(contentId);
      expect(listing.isActive).to.be.false;

      await expect(licensing.connect(user2).purchaseLicense(contentHash, { value: price }))
        .to.be.revertedWith("Listing is not active");
    });

    it("10. Duplicate purchases by the same buyer are rejected", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      await licensing.connect(user2).purchaseLicense(contentHash, { value: price });

      await expect(licensing.connect(user2).purchaseLicense(contentHash, { value: price }))
        .to.be.revertedWith("Already purchased");
    });

    it("11. Insufficient payments are rejected", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      const lowPrice = hre.ethers.parseEther("0.005");

      await expect(licensing.connect(user2).purchaseLicense(contentHash, { value: lowPrice }))
        .to.be.revertedWith("Insufficient payment");
    });

    it("12. Creator can update price and status", async function () {
      await licensing.connect(user1).createListing(contentHash, price, terms);
      const newPrice = hre.ethers.parseEther("0.05");

      await expect(licensing.connect(user1).updateListing(contentHash, newPrice, true))
        .to.emit(licensing, "ListingUpdated")
        .withArgs(await registry.hashToContentId(contentHash), newPrice, true);

      const contentId = await registry.hashToContentId(contentHash);
      const listing = await licensing.listings(contentId);
      expect(listing.price).to.equal(newPrice);
    });
  });
});
