import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const Registry = await hre.ethers.getContractFactory("CopyrightRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("CopyrightRegistry deployed to:", registryAddress);

  const Licensing = await hre.ethers.getContractFactory("ContentLicensing");
  const licensing = await Licensing.deploy(registryAddress);
  await licensing.waitForDeployment();
  const licensingAddress = await licensing.getAddress();
  console.log("ContentLicensing deployed to:", licensingAddress);

  // Seed default registered creator works for Account 1
  const seedHashes = [
    '0x90d94daac997eacaea655e89235db922860ddd9135bae31ceaa46cc8d4df98f2',
    '0x1b2e9adb205ba450a83a3b131c09c9199278c2862478176719daa02e9e24a203',
    '0x15698fbc17dd49bb2056d8c4a5d9ee074b118b586f55a1b9f473f01125d1c279'
  ];
  for (const h of seedHashes) {
    const isReg = await registry.isRegistered(h);
    if (!isReg) {
      const tx = await registry.registerContent(h);
      await tx.wait();
    }
  }
  // Seed an initial active licence offer for testing
  const firstHash = seedHashes[0];
  const regInfo = await registry.getRegistration(firstHash);
  const existingListing = await licensing.listings(regInfo.contentId);
  if (!existingListing.isActive) {
    const priceWei = hre.ethers.parseEther("0.01");
    const terms = "Educational use; No resale or commercial redistribution";
    const tx = await licensing.createListing(firstHash, priceWei, terms);
    await tx.wait();
    console.log("Seeded initial active licence offer on marketplace.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
