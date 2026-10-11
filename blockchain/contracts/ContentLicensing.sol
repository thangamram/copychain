// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./CopyrightRegistry.sol";

contract ContentLicensing {
    CopyrightRegistry public registry;

    struct LicenseListing {
        bytes32 contentId;
        uint256 price; // in wei
        bool isActive;
        string terms;
    }

    struct License {
        bytes32 contentId;
        address licensee;
        uint256 purchaseTime;
        string terms;
    }

    // Mapping from contentId to its listing
    mapping(bytes32 => LicenseListing) public listings;
    
    // Array of all listed contentIds for enumeration
    bytes32[] public allListingIds;
    mapping(bytes32 => bool) private hasBeenListed;

    // Mapping from contentId to an array of licensees
    mapping(bytes32 => License[]) public licensesByContent;
    
    // Quick check if address has license for content
    mapping(bytes32 => mapping(address => bool)) public hasLicense;

    event ListingCreated(bytes32 indexed contentId, uint256 price, string terms);
    event ListingUpdated(bytes32 indexed contentId, uint256 newPrice, bool isActive);
    event ListingCancelled(bytes32 indexed contentId);
    event LicensePurchased(bytes32 indexed contentId, address indexed licensee, uint256 price);

    constructor(address _registryAddress) {
        registry = CopyrightRegistry(_registryAddress);
    }

    function createListing(string memory _contentHash, uint256 _price, string memory _terms) public {
        CopyrightRegistry.Registration memory reg = registry.getRegistration(_contentHash);
        require(reg.creator == msg.sender, "Only creator can list for licensing");
        require(reg.isRegistered, "Content not registered");
        require(!listings[reg.contentId].isActive, "Listing already active");

        listings[reg.contentId] = LicenseListing({
            contentId: reg.contentId,
            price: _price,
            isActive: true,
            terms: _terms
        });

        if (!hasBeenListed[reg.contentId]) {
            allListingIds.push(reg.contentId);
            hasBeenListed[reg.contentId] = true;
        }

        emit ListingCreated(reg.contentId, _price, _terms);
    }

    function updateListing(string memory _contentHash, uint256 _price, bool _isActive) public {
        CopyrightRegistry.Registration memory reg = registry.getRegistration(_contentHash);
        require(reg.creator == msg.sender, "Only creator can update listing");
        require(listings[reg.contentId].contentId == reg.contentId, "Listing does not exist");

        listings[reg.contentId].price = _price;
        listings[reg.contentId].isActive = _isActive;

        emit ListingUpdated(reg.contentId, _price, _isActive);
    }

    function cancelListing(string memory _contentHash) public {
        CopyrightRegistry.Registration memory reg = registry.getRegistration(_contentHash);
        require(reg.creator == msg.sender, "Only creator can cancel listing");
        require(listings[reg.contentId].contentId == reg.contentId, "Listing does not exist");
        require(listings[reg.contentId].isActive, "Listing is already inactive");

        listings[reg.contentId].isActive = false;

        emit ListingCancelled(reg.contentId);
        emit ListingUpdated(reg.contentId, listings[reg.contentId].price, false);
    }

    function purchaseLicense(string memory _contentHash) public payable {
        CopyrightRegistry.Registration memory reg = registry.getRegistration(_contentHash);
        bytes32 cId = reg.contentId;
        
        LicenseListing memory listing = listings[cId];
        require(listing.isActive, "Listing is not active");
        require(reg.creator != msg.sender, "Cannot purchase own license");
        require(msg.value >= listing.price, "Insufficient payment");
        require(!hasLicense[cId][msg.sender], "Already purchased");

        // Transfer payment to creator
        (bool success, ) = payable(reg.creator).call{value: listing.price}("");
        require(success, "Transfer failed");

        // Refund any excess payment
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");
        }

        licensesByContent[cId].push(License({
            contentId: cId,
            licensee: msg.sender,
            purchaseTime: block.timestamp,
            terms: listing.terms
        }));

        hasLicense[cId][msg.sender] = true;

        emit LicensePurchased(cId, msg.sender, listing.price);
    }

    function checkLicense(string memory _contentHash, address _user) public view returns (bool) {
        bytes32 cId = registry.hashToContentId(_contentHash);
        require(cId != bytes32(0), "Content not registered");
        return hasLicense[cId][_user];
    }

    function getListingCount() public view returns (uint256) {
        return allListingIds.length;
    }

    function getLicensesCount(bytes32 _contentId) public view returns (uint256) {
        return licensesByContent[_contentId].length;
    }
}
