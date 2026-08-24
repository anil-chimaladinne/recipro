// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SkillCreditEscrow
 * @notice Production-grade on-chain escrow & settlement proof anchor for SkillSwap Campus
 * @dev Implements Pausable, ReentrancyGuard, and checks-effects-interactions
 */

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Ownable: zero address");
        _owner = initialOwner;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }
}

abstract contract Pausable is Context {
    bool private _paused;

    event Paused(address account);
    event Unpaused(address account);

    constructor() {
        _paused = false;
    }

    modifier whenNotPaused() {
        require(!_paused, "Pausable: paused");
        _;
    }

    modifier whenPaused() {
        require(_paused, "Pausable: not paused");
        _;
    }

    function paused() public view virtual returns (bool) {
        return _paused;
    }

    function _pause() internal virtual whenNotPaused {
        _paused = true;
        emit Paused(_msgSender());
    }

    function _unpause() internal virtual whenPaused {
        _paused = false;
        emit Unpaused(_msgSender());
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

contract SkillCreditEscrow is Ownable, Pausable, ReentrancyGuard {
    enum EscrowStatus { NONE, RESERVED, SETTLED, REFUNDED, DISPUTED }

    struct SessionAgreement {
        bytes32 sessionIdHash;
        address learner;
        address teacher;
        uint256 creditsAmount;
        uint256 creationTimestamp;
        EscrowStatus status;
        bool learnerConfirmed;
        bool teacherConfirmed;
    }

    // Mapping from sessionIdHash to SessionAgreement
    mapping(bytes32 => SessionAgreement) public agreements;
    
    // Settled session hashes (prevents replay and duplicate settlement)
    mapping(bytes32 => bool) public settledSessions;

    // Authorized campus settlement oracle
    address public settlementOracle;

    // Events
    event EscrowReserved(bytes32 indexed sessionIdHash, address indexed learner, address indexed teacher, uint256 credits);
    event SessionConfirmed(bytes32 indexed sessionIdHash, address indexed confirmer);
    event EscrowSettled(bytes32 indexed sessionIdHash, address indexed teacher, uint256 credits, bytes32 txProof);
    event EscrowRefunded(bytes32 indexed sessionIdHash, address indexed learner, string reason);
    event DisputeLogged(bytes32 indexed sessionIdHash, string reason);
    event SettlementOracleUpdated(address indexed newOracle);

    modifier onlyOracleOrOwner() {
        require(msg.sender == settlementOracle || msg.sender == owner(), "Caller not authorized oracle or owner");
        _;
    }

    constructor(address _settlementOracle) Ownable(msg.sender) {
        require(_settlementOracle != address(0), "Invalid oracle address");
        settlementOracle = _settlementOracle;
    }

    function setSettlementOracle(address _newOracle) external onlyOwner {
        require(_newOracle != address(0), "Invalid oracle address");
        settlementOracle = _newOracle;
        emit SettlementOracleUpdated(_newOracle);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Reserve session escrow record
     */
    function reserveEscrow(
        bytes32 sessionIdHash,
        address teacher,
        uint256 creditsAmount
    ) external whenNotPaused nonReentrant {
        require(sessionIdHash != bytes32(0), "Invalid session hash");
        require(teacher != address(0), "Invalid teacher address");
        require(teacher != msg.sender, "Cannot escrow with self");
        require(creditsAmount > 0, "Credits amount must be > 0");
        require(agreements[sessionIdHash].status == EscrowStatus.NONE, "Escrow already exists");
        require(!settledSessions[sessionIdHash], "Session already settled");

        agreements[sessionIdHash] = SessionAgreement({
            sessionIdHash: sessionIdHash,
            learner: msg.sender,
            teacher: teacher,
            creditsAmount: creditsAmount,
            creationTimestamp: block.timestamp,
            status: EscrowStatus.RESERVED,
            learnerConfirmed: false,
            teacherConfirmed: false
        });

        emit EscrowReserved(sessionIdHash, msg.sender, teacher, creditsAmount);
    }

    /**
     * @notice Confirm session completion by participant
     */
    function confirmCompletion(bytes32 sessionIdHash) external whenNotPaused {
        SessionAgreement storage agreement = agreements[sessionIdHash];
        require(agreement.status == EscrowStatus.RESERVED, "Escrow is not active");
        require(msg.sender == agreement.learner || msg.sender == agreement.teacher, "Not a participant");

        if (msg.sender == agreement.learner) {
            agreement.learnerConfirmed = true;
        } else {
            agreement.teacherConfirmed = true;
        }

        emit SessionConfirmed(sessionIdHash, msg.sender);

        // If both confirmed, settle
        if (agreement.learnerConfirmed && agreement.teacherConfirmed) {
            _executeSettlement(sessionIdHash, agreement);
        }
    }

    /**
     * @notice Oracle / Moderator settlement execution
     */
    function settleSessionByOracle(
        bytes32 sessionIdHash,
        bytes32 txProof
    ) external onlyOracleOrOwner whenNotPaused nonReentrant {
        SessionAgreement storage agreement = agreements[sessionIdHash];
        require(agreement.status == EscrowStatus.RESERVED || agreement.status == EscrowStatus.DISPUTED, "Invalid escrow status");
        require(!settledSessions[sessionIdHash], "Already settled");

        _executeSettlement(sessionIdHash, agreement);
        emit EscrowSettled(sessionIdHash, agreement.teacher, agreement.creditsAmount, txProof);
    }

    /**
     * @notice Internal settlement executor
     */
    function _executeSettlement(bytes32 sessionIdHash, SessionAgreement storage agreement) internal {
        require(!settledSessions[sessionIdHash], "Double settlement guard");
        
        // Checks-Effects-Interactions
        agreement.status = EscrowStatus.SETTLED;
        settledSessions[sessionIdHash] = true;

        emit EscrowSettled(sessionIdHash, agreement.teacher, agreement.creditsAmount, sessionIdHash);
    }

    /**
     * @notice Refund escrow to learner (e.g. on cancellation or dispute resolution)
     */
    function refundEscrow(
        bytes32 sessionIdHash,
        string calldata reason
    ) external onlyOracleOrOwner whenNotPaused nonReentrant {
        SessionAgreement storage agreement = agreements[sessionIdHash];
        require(agreement.status == EscrowStatus.RESERVED || agreement.status == EscrowStatus.DISPUTED, "Cannot refund non-active escrow");
        require(!settledSessions[sessionIdHash], "Cannot refund settled session");

        agreement.status = EscrowStatus.REFUNDED;
        emit EscrowRefunded(sessionIdHash, agreement.learner, reason);
    }

    /**
     * @notice Log dispute
     */
    function flagDispute(bytes32 sessionIdHash, string calldata reason) external whenNotPaused {
        SessionAgreement storage agreement = agreements[sessionIdHash];
        require(msg.sender == agreement.learner || msg.sender == agreement.teacher || msg.sender == owner(), "Unauthorized");
        require(agreement.status == EscrowStatus.RESERVED, "Only active escrows can be disputed");

        agreement.status = EscrowStatus.DISPUTED;
        emit DisputeLogged(sessionIdHash, reason);
    }
}
