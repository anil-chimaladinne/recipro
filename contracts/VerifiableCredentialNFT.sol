// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VerifiableCredentialNFT
 * @notice Soulbound Verifiable Credential Certificates for SkillSwap Campus
 */
contract VerifiableCredentialNFT {
    string public name = "SkillSwap Campus Verifiable Credential";
    string public symbol = "SKILLCERT";
    address public owner;
    address public authorizedIssuer;

    struct CredentialData {
        address recipient;
        string credentialTitle;
        string skillId;
        string criteriaHash;
        uint256 issuedAt;
        bool isRevoked;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => CredentialData) public credentials;
    mapping(address => uint256[]) public recipientCredentials;
    mapping(bytes32 => bool) public issuedCriteriaHashes;

    event CredentialIssued(uint256 indexed tokenId, address indexed recipient, string title, string skillId);
    event CredentialRevoked(uint256 indexed tokenId, string reason);
    event IssuerUpdated(address indexed newIssuer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only contract owner");
        _;
    }

    modifier onlyIssuerOrOwner() {
        require(msg.sender == authorizedIssuer || msg.sender == owner, "Only authorized issuer or owner");
        _;
    }

    constructor(address _initialIssuer) {
        owner = msg.sender;
        authorizedIssuer = _initialIssuer;
    }

    function setAuthorizedIssuer(address _newIssuer) external onlyOwner {
        require(_newIssuer != address(0), "Invalid address");
        authorizedIssuer = _newIssuer;
        emit IssuerUpdated(_newIssuer);
    }

    /**
     * @notice Issue a verifiable soulbound credential upon deterministic condition satisfaction
     */
    function issueCredential(
        address recipient,
        string calldata title,
        string calldata skillId,
        string calldata criteriaHash
    ) external onlyIssuerOrOwner returns (uint256) {
        require(recipient != address(0), "Invalid recipient");
        bytes32 uniqueKey = keccak2off(recipient, skillId, title);
        require(!issuedCriteriaHashes[uniqueKey], "Credential already issued for recipient");

        uint256 tokenId = _nextTokenId++;
        credentials[tokenId] = CredentialData({
            recipient: recipient,
            credentialTitle: title,
            skillId: skillId,
            criteriaHash: criteriaHash,
            issuedAt: block.timestamp,
            isRevoked: false
        });

        recipientCredentials[recipient].push(tokenId);
        issuedCriteriaHashes[uniqueKey] = true;

        emit CredentialIssued(tokenId, recipient, title, skillId);
        return tokenId;
    }

    function revokeCredential(uint256 tokenId, string calldata reason) external onlyIssuerOrOwner {
        require(credentials[tokenId].recipient != address(0), "Credential does not exist");
        require(!credentials[tokenId].isRevoked, "Already revoked");

        credentials[tokenId].isRevoked = true;
        emit CredentialRevoked(tokenId, reason);
    }

    function getCredentialsByRecipient(address recipient) external view returns (uint256[] memory) {
        return recipientCredentials[recipient];
    }

    function keccak2off(address recipient, string memory skillId, string memory title) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(recipient, skillId, title));
    }
}
