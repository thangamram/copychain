// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CopyrightRegistry {
    struct Registration {
        bytes32 contentId;
        string contentHash;
        address creator;
        uint256 timestamp;
        bytes32 parentContentId; // For derivative works. 0 if original.
        bool isRegistered;
    }

    mapping(bytes32 => Registration) public registrations;
    mapping(string => bytes32) public hashToContentId;
    
    event ContentRegistered(bytes32 indexed contentId, string contentHash, address indexed creator, uint256 timestamp);
    event DerivativeRegistered(bytes32 indexed contentId, bytes32 indexed parentContentId, string contentHash, address indexed creator, uint256 timestamp);

    function registerContent(string memory _contentHash) public returns (bytes32) {
        require(bytes(_contentHash).length > 0, "Hash cannot be empty");
        require(hashToContentId[_contentHash] == bytes32(0), "Hash already registered");

        bytes32 contentId = keccak256(abi.encodePacked(_contentHash, msg.sender, block.timestamp));
        
        registrations[contentId] = Registration({
            contentId: contentId,
            contentHash: _contentHash,
            creator: msg.sender,
            timestamp: block.timestamp,
            parentContentId: bytes32(0),
            isRegistered: true
        });

        hashToContentId[_contentHash] = contentId;

        emit ContentRegistered(contentId, _contentHash, msg.sender, block.timestamp);
        
        return contentId;
    }

    function registerDerivative(string memory _contentHash, bytes32 _parentContentId) public returns (bytes32) {
        require(bytes(_contentHash).length > 0, "Hash cannot be empty");
        require(hashToContentId[_contentHash] == bytes32(0), "Hash already registered");
        require(registrations[_parentContentId].isRegistered, "Parent content not registered");
        // We only allow original creator or someone with permission to register derivative? 
        // Requirements say: "Only create a derivative relationship when the registering user has the required authorization"
        // For simplicity in the registry, we enforce that the parent creator is the one registering, 
        // OR authorization could be checked via the Licensing contract (which is complex to couple here). 
        // Let's enforce that only the original creator can register derivatives for now.
        require(registrations[_parentContentId].creator == msg.sender, "Not authorized to register derivative");

        bytes32 contentId = keccak256(abi.encodePacked(_contentHash, msg.sender, block.timestamp));
        
        registrations[contentId] = Registration({
            contentId: contentId,
            contentHash: _contentHash,
            creator: msg.sender,
            timestamp: block.timestamp,
            parentContentId: _parentContentId,
            isRegistered: true
        });

        hashToContentId[_contentHash] = contentId;

        emit DerivativeRegistered(contentId, _parentContentId, _contentHash, msg.sender, block.timestamp);
        
        return contentId;
    }

    function isRegistered(string memory _contentHash) public view returns (bool) {
        return hashToContentId[_contentHash] != bytes32(0);
    }
    
    function getRegistration(string memory _contentHash) public view returns (Registration memory) {
        bytes32 contentId = hashToContentId[_contentHash];
        require(contentId != bytes32(0), "Content not registered");
        return registrations[contentId];
    }
}
