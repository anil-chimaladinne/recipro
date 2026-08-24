// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SkillSwapAnchor
 * @notice Merkle State Anchor for Auditable Campus Milestones & Batch Settlement Proofs
 */
contract SkillSwapAnchor {
    address public owner;

    struct AnchorRecord {
        bytes32 merkleRoot;
        uint256 timestamp;
        uint256 batchCount;
        string metadataUri;
    }

    AnchorRecord[] public anchors;
    event AnchorCommitted(uint256 indexed anchorIndex, bytes32 indexed merkleRoot, uint256 batchCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function commitAnchor(
        bytes32 merkleRoot,
        uint256 batchCount,
        string calldata metadataUri
    ) external onlyOwner returns (uint256) {
        require(merkleRoot != bytes32(0), "Invalid merkle root");

        anchors.push(AnchorRecord({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            batchCount: batchCount,
            metadataUri: metadataUri
        }));

        uint256 index = anchors.length - 1;
        emit AnchorCommitted(index, merkleRoot, batchCount);
        return index;
    }

    function getAnchorCount() external view returns (uint256) {
        return anchors.length;
    }
}
