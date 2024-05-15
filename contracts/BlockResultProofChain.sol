// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./IOperationalStaking.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BlockResultProofChain is OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    IOperationalStaking _stakingInterface; // staking contract (deprecated)

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant BLOCK_RESULT_PRODUCER_ROLE = keccak256("BLOCK_RESULT_PRODUCER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    uint256 private constant _DIVIDER = 10 ** 18; // 18 decimals used for scaling

    uint256 private _blockResultQuorum; // The value is represented as a uint <= 10**18. The threshold value will later be divided by 10**18 to represent it as a percentage.  e.g.) 10**18 == 100%; 5 * 10**17 == 50%;
    uint256 private _secondsPerBlockCurrentChain; // average block time on the chain where the ProofChain is deployed
    uint128 private _blockResultRewardAllocation; // the reward allocated per block hash
    uint128 private _brpRequiredStake; // how much a validator should have staked in order to run an operator
    uint64 private _blockResultSessionDuration; // the length of a session in blocks
    uint64 private _minSubmissionsRequired; // min number of participants who submitted the agreed result hash in order for the quorum to be achieved

    EnumerableSetUpgradeable.Bytes32Set private _roleNames; // set of all role names

    EnumerableSetUpgradeable.AddressSet private _blockResultProducers; // currently enabled block result producer operators
    EnumerableSetUpgradeable.AddressSet private _governors; // governor operators
    EnumerableSetUpgradeable.AddressSet private _auditors; // auditor operators

    mapping(address => uint128) public validatorIDs; // maps an operator address to validatorId
    mapping(uint128 => EnumerableSetUpgradeable.AddressSet) private _validatorOperators; // operator addresses that validator owns
    mapping(address => bytes32) public operatorRoles; // operator address => role
    mapping(uint128 => uint128) private _validatorActiveOperatorsCounters; // how many operators are enabled per validator given validator id
    mapping(uint64 => mapping(uint64 => BlockResultSession)) private _sessions; // chainId => blockHeight
    mapping(uint64 => ChainData) private _chainData; // by chain id

    mapping(bytes32 => string[]) private _urls; // hash => urls
    mapping(uint128 => address) private _validatorAddresses; // validatorId => validator address (deprecated)
    mapping(uint128 => bool) private _validatorEnabled; // validatorId => enabled?
    address private _stakingManager;

    struct ChainData {
        uint256 blockOnTargetChain; // block number on the chain for which BRP are produced which is mapped to the current chain block
        uint256 blockOnCurrentChain; // block number on the chain where the ProofChain is deployed. it is mapped to the target chain block
        uint256 secondsPerBlockTargetChain; // average block time on the chain for which BRP is generated
        uint128 allowedThreshold; // block offsett threshold, used to handle minor de-synchronization over time
        uint128 maxSubmissionsPerBlockHeight; // max number of block hashes allowed to submit per block height
        uint64 nthBlock; // block divisor
    }

    struct BlockSpecimenProperties {
        mapping(bytes32 => address[]) participants; // result hash => operators who submitted the result hash
        bytes32[] resultHashes; // raw result hashes
    }

    struct SessionParticipantData {
        uint128 stake; // stake at the time when an operator submitted the first result hash (deprecate now (always 0))
        uint128 submissionCounter; // how many result hashes an operator has submitted
    }

    struct BlockResultSession {
        mapping(bytes32 => BlockSpecimenProperties) blockSpecimenProperties; // block specimen hash => block specimen properties
        bytes32[] blockSpecimenHashesRaw;
        mapping(address => SessionParticipantData) participantsData; // stake and submission counter, pack these together to save gas
        uint64 sessionDeadline; // the last block when an operator can submit a result hash
        bool isSessionDone; // marker for session finalization
    }

    event OperatorAdded(address operator, uint128 validatorId, bytes32 role);

    event OperatorRemoved(address operator, uint128 validatorId, uint128 activeOperatorCount, bytes32 role);

    event ValidatorEnabled(uint128 validatorId);

    event ValidatorDisabled(uint128 validatorId);

    event BlockResultProductionProofSubmitted(
        uint64 chainId,
        uint64 blockHeight,
        bytes32 blockSpecimenHash,
        bytes32 resultHash, // SHA-256 content-hash of result object file;
        string storageURL // URL of result storage
    );

    event SessionStarted(uint64 indexed chainId, uint64 indexed blockHeight, uint64 deadline);

    event QuorumNotReached(uint64 indexed chainId, uint64 blockHeight);

    event BlockResultRewardChanged(uint128 newBlockResultRewardAllocation);

    event MinimumRequiredStakeChanged(uint128 newStakeRequirement);

    event StakingManagerChanged(address newStakingManager);

    event ResultSessionQuorumChanged(uint256 newQuorumThreshold);

    event ResultSessionDurationChanged(uint64 newSessionDuration);

    event ResultSessionMinSubmissionChanged(uint64 minSubmissions);

    event NthBlockChanged(uint64 indexed chainId, uint64 indexed nthBlock);

    event MaxSubmissionsPerBlockHeightChanged(uint256 maxSubmissions);

    event ChainSyncDataChanged(uint64 indexed chainId, uint256 blockOnTargetChain, uint256 blockOnCurrentChain, uint256 secondsPerBlockTargetChain);

    event SecondsPerBlockCurrentChainChanged(uint64 indexed secondsPerBlockCurrentChain);

    event BlockHeightSubmissionThresholdChanged(uint64 indexed chainId, uint64 threshold);

    event BlockResultQuorum(uint64 indexed chainId, uint64 indexed blockHeight, uint256 validatorBitMap, bytes32 indexed blockSpecimenHash, bytes32 resulthash);

    modifier onlyGovernor() {
        require(_governors.contains(msg.sender), "Sender is not GOVERNANCE_ROLE");
        _;
    }

    modifier onlyStakingManager() {
        require(msg.sender == _stakingManager, "Sender is not staking manager");
        _;
    }

    function initialize(address initialGovernor, address stakingManager) public initializer {
        require(initialGovernor != address(0), "Invalid governor address");
        __Ownable_init();

        _governors.add(msg.sender);

        _roleNames.add(GOVERNANCE_ROLE);
        _roleNames.add(BLOCK_RESULT_PRODUCER_ROLE);
        _roleNames.add(AUDITOR_ROLE);

        setQuorumThreshold(_DIVIDER / 2); // 50%
        setBlockResultReward(10 ** 14); // 0.0001
        setBlockResultSessionDuration(240); // blocks
        setMinSubmissionsRequired(2);
        setStakingManagerAddress(stakingManager);
        _governors.remove(msg.sender);

        operatorRoles[initialGovernor] = GOVERNANCE_ROLE;
        _governors.add(initialGovernor);
        emit OperatorAdded(initialGovernor, 0, GOVERNANCE_ROLE);
    }

    function disableValidator(uint128 validatorId) external onlyStakingManager {
        // when remove/disable Brp is called, it emits an event, which might then cause bridge agent to
        // disable this.
        require(validatorId < 256, "validatorId out of range");
        _validatorEnabled[validatorId] = false;
        emit ValidatorDisabled(validatorId);
    }

    /**
     * Enables the given operator on the staking contract
     */
    function enableValidator(uint128 validatorId) external onlyStakingManager {
        // when addBRP is done, it emits an event, which might then cause bridge agent
        // to enable this.
        require(validatorId < 256, "validatorId out of range");
        _validatorEnabled[validatorId] = true;
        emit ValidatorEnabled(validatorId);
    }

    /**
     * Disables the operator instance.
     * If all addresses of the operator are disabled, then the operator (validator) instance will get disabled on the staking contract
     */
    function _removeBRPOperatorFromActiveInstances(address operator) internal {
        _blockResultProducers.remove(operator);
        uint128 validatorId = validatorIDs[operator];
        _validatorActiveOperatorsCounters[validatorId]--;
    }

    /**
     * Adds the given address to the block result producers set
     */
    function addBRPOperator(address operator, uint128 validatorId) external onlyGovernor {
        require(operator != address(0), "Invalid operator address");
        require(operatorRoles[operator] == 0, "Operator already exists");
        require(validatorId <= 255, "Validator ID cannot be greater than 255");
        operatorRoles[operator] = BLOCK_RESULT_PRODUCER_ROLE;
        validatorIDs[operator] = validatorId;
        _validatorOperators[validatorId].add(operator);

        _blockResultProducers.add(operator);
        _validatorActiveOperatorsCounters[validatorId]++;
        emit OperatorAdded(operator, validatorId, BLOCK_RESULT_PRODUCER_ROLE);
    }

    /**
     * Removes the given address from the block result producers set
     */
    function removeBRPOperator(address operator) external onlyGovernor {
        require(operatorRoles[operator] == BLOCK_RESULT_PRODUCER_ROLE, "Operator is not BRP");
        require(_blockResultProducers.contains(operator), "Operator not found in active instances");
        _removeBRPOperatorFromActiveInstances(operator);
        uint128 validatorID = validatorIDs[operator];
        _validatorOperators[validatorID].remove(operator);
        validatorIDs[operator] = 0;
        operatorRoles[operator] = 0;
        emit OperatorRemoved(operator, validatorID, _validatorActiveOperatorsCounters[validatorID], BLOCK_RESULT_PRODUCER_ROLE);
    }

    /**
     * Adds the given address to the auditors set
     */
    function addAuditor(address auditor) external onlyGovernor {
        require(auditor != address(0), "Invalid auditor address");
        require(operatorRoles[auditor] == 0, "Operator already exists");
        operatorRoles[auditor] = AUDITOR_ROLE;
        _auditors.add(auditor);
        emit OperatorAdded(auditor, 0, AUDITOR_ROLE);
    }

    /**
     * Removes the given address from the auditors set
     */
    function removeAuditor(address auditor) external onlyGovernor {
        require(operatorRoles[auditor] == AUDITOR_ROLE, "Operator is not auditor");
        operatorRoles[auditor] = 0;
        _auditors.remove(auditor);
        emit OperatorRemoved(auditor, 0, 0, AUDITOR_ROLE);
    }

    /**
     * Adds the given address to the governors set
     */
    function addGovernor(address governor) external onlyOwner {
        require(governor != address(0), "Invalid governor address");
        require(operatorRoles[governor] == 0, "Operator already exists");
        operatorRoles[governor] = GOVERNANCE_ROLE;
        _governors.add(governor);
        emit OperatorAdded(governor, 0, GOVERNANCE_ROLE);
    }

    /**
     * Removes the given address from the governors set
     */
    function removeGovernor(address governor) external onlyOwner {
        require(operatorRoles[governor] == GOVERNANCE_ROLE, "Operator is not governor");
        operatorRoles[governor] = 0;
        _governors.remove(governor);
        emit OperatorRemoved(governor, 0, 0, GOVERNANCE_ROLE);
    }

    /**
     * Updates the address of the staking manager
     */
    function setStakingManagerAddress(address stakingManagerAddress) public onlyGovernor {
        require(stakingManagerAddress != address(0), "Invalid address");
        _stakingManager = stakingManagerAddress;
        emit StakingManagerChanged(stakingManagerAddress);
    }

    /**
     * Update the Block Result Quorum Threshold.
     */
    function setQuorumThreshold(uint256 quorum) public onlyGovernor {
        require(quorum <= _DIVIDER, "Quorum cannot be greater than 100%");
        _blockResultQuorum = quorum;
        emit ResultSessionQuorumChanged(quorum);
    }

    /**
     * Update block divisor
     */
    function setNthBlock(uint64 chainId, uint64 n) public onlyGovernor {
        require(n > 0, "Nth block cannot be 0");
        _chainData[chainId].nthBlock = n;
        emit NthBlockChanged(chainId, n);
    }

    /**
     * Update the reward allocation per block result.
     */
    function setBlockResultReward(uint128 newBlockResultReward) public onlyGovernor {
        require(newBlockResultReward <= 1000 * _DIVIDER, "Block result reward cannot be greater than 1000*DIVIDER");
        _blockResultRewardAllocation = newBlockResultReward;
        emit BlockResultRewardChanged(newBlockResultReward);
    }

    /**
     * Update the duration of a result session in blocks
     */
    function setBlockResultSessionDuration(uint64 newSessionDuration) public onlyGovernor {
        require(newSessionDuration > 0, "Session duration cannot be 0");
        _blockResultSessionDuration = newSessionDuration;
        emit ResultSessionDurationChanged(newSessionDuration);
    }

    /**
     * Update the minimum # of submissions required in order to reach quorum
     */
    function setMinSubmissionsRequired(uint64 minSubmissions) public onlyGovernor {
        require(minSubmissions >= 1, "Minimum submissions must be at least 1");
        require(minSubmissions <= 255, "Maximum allowed minimum submissions is 255");
        _minSubmissionsRequired = minSubmissions;
        emit ResultSessionMinSubmissionChanged(minSubmissions);
    }

    /**
     * Update the max # of submissions per operator per block height
     */
    function setMaxSubmissionsPerBlockHeight(uint64 chainId, uint64 maxSubmissions) public onlyGovernor {
        require(maxSubmissions > 0, "Max submissions cannot be 0");
        require(maxSubmissions <= 3, "Max submissions cannot be more than 3");
        require(_chainData[chainId].nthBlock != 0, "Invalid chain ID");
        _chainData[chainId].maxSubmissionsPerBlockHeight = maxSubmissions;
        emit MaxSubmissionsPerBlockHeightChanged(maxSubmissions);
    }

    /**
     * Update chain sync data
     */
    function setChainSyncData(uint64 chainId, uint256 blockOnTargetChain, uint256 blockOnCurrentChain, uint256 secondsPerBlockTargetChain) external onlyGovernor {
        ChainData storage cd = _chainData[chainId];
        require(secondsPerBlockTargetChain > 0, "Seconds per block cannot be 0");
        cd.blockOnTargetChain = blockOnTargetChain;
        cd.blockOnCurrentChain = blockOnCurrentChain;
        cd.secondsPerBlockTargetChain = secondsPerBlockTargetChain;
        emit ChainSyncDataChanged(chainId, blockOnTargetChain, blockOnCurrentChain, secondsPerBlockTargetChain);
    }

    /**
     * Update block height submission threshold for live sync
     */
    function setBlockHeightSubmissionsThreshold(uint64 chainId, uint64 threshold) external onlyGovernor {
        require(threshold > 0, "Threshold cannot be 0");
        _chainData[chainId].allowedThreshold = threshold;
        emit BlockHeightSubmissionThresholdChanged(chainId, threshold);
    }

    /**
     * Update seconds per block on the chain where the ProofChain is deployed
     */
    function setSecondsPerBlockCurrentChain(uint64 secondsPerBlockCurrentChain) external onlyGovernor {
        require(secondsPerBlockCurrentChain > 0, "Seconds per block cannot be 0");
        _secondsPerBlockCurrentChain = secondsPerBlockCurrentChain;
        emit SecondsPerBlockCurrentChainChanged(secondsPerBlockCurrentChain);
    }

    /**
     * Block Result Producers submit their block result proofs using this function.
     */
    function submitBlockResultProof(uint64 chainId, uint64 blockHeight, bytes32 blockSpecimenHash, bytes32 resultHash, string calldata storageURL) external {
        require(_isValidSpecimenHash(blockSpecimenHash), "Invalid specimen hash");
        require(_isValidResultHash(resultHash), "Invalid result hash");
        require(_isValidStorageURL(storageURL), "Invalid storage URL");
        require(_blockResultProducers.contains(msg.sender), "Sender is not BLOCK_RESULT_PRODUCER_ROLE");
        ChainData storage cd = _chainData[chainId];
        require(cd.nthBlock != 0, "Invalid chain ID");
        require(blockHeight % cd.nthBlock == 0, "Invalid block height");

        BlockResultSession storage session = _sessions[chainId][blockHeight];
        uint64 sessionDeadline = session.sessionDeadline;
        SessionParticipantData storage participantsData = session.participantsData[msg.sender];

        // if this is the first result to be submitted for a block, initialize a new session
        if (sessionDeadline == 0) {
            require(!session.isSessionDone, "Session submissions have closed");

            uint256 currentBlockOnTargetChain = cd.blockOnTargetChain + (((block.number - cd.blockOnCurrentChain) * _secondsPerBlockCurrentChain) / cd.secondsPerBlockTargetChain);
            uint256 lowerBound = currentBlockOnTargetChain >= cd.allowedThreshold ? currentBlockOnTargetChain - (cd.allowedThreshold / 2) : 0;
            uint256 upperBound = currentBlockOnTargetChain + (cd.allowedThreshold / 2);
            require(lowerBound <= blockHeight && blockHeight <= upperBound, "Block height is out of bounds for live sync");
            session.sessionDeadline = uint64(block.number + _blockResultSessionDuration);

            emit SessionStarted(chainId, blockHeight, session.sessionDeadline);

            uint128 validatorID = validatorIDs[msg.sender];

            require(_validatorEnabled[validatorID], "Validator is not enabled");

            session.blockSpecimenHashesRaw.push(blockSpecimenHash);
            BlockSpecimenProperties storage bh = session.blockSpecimenProperties[blockSpecimenHash];
            bh.resultHashes.push(resultHash);

            bh.participants[resultHash].push(msg.sender);
            participantsData.submissionCounter++;
        } else {
            require(block.number <= sessionDeadline, "Session submissions have closed");
            require(participantsData.submissionCounter < cd.maxSubmissionsPerBlockHeight, "Max submissions limit exceeded");

            BlockSpecimenProperties storage bh = session.blockSpecimenProperties[blockSpecimenHash];
            bytes32[] storage resultHashes = bh.resultHashes;

            uint128 validatorID = validatorIDs[msg.sender];
            require(_validatorEnabled[validatorID], "Validator is not enabled");

            // check if proof submission was made for this block specimen hash
            // this should be at about (nValidators * maxSubmissionsPerBlockHeight) iterations
            // which would typically be less than 50
            for (uint256 j = 0; j < resultHashes.length && j < 50; j++) {
                address[] storage resultHashParticipants = bh.participants[resultHashes[j]];
                for (uint256 k = 0; k < resultHashParticipants.length; k++)
                    require(resultHashParticipants[k] != msg.sender, "Operator already submitted for the provided block hash");
            }

            address[] storage participants = bh.participants[resultHash];
            if (resultHashes.length != 0) {
                if (participants.length == 0) resultHashes.push(resultHash);
            } else {
                session.blockSpecimenHashesRaw.push(blockSpecimenHash);
                resultHashes.push(resultHash);
            }

            participants.push(msg.sender);
            participantsData.submissionCounter++;
        }
        _urls[resultHash].push(storageURL);

        emit BlockResultProductionProofSubmitted(chainId, blockHeight, blockSpecimenHash, resultHash, storageURL);
    }

    /**
     * This is the new finalize function that works with staking contract in ethereum
     */
    function finalizeResultSession(uint64 chainId, uint64 blockHeight) public {
        BlockResultSession storage session = _sessions[chainId][blockHeight];
        uint64 sessionDeadline = session.sessionDeadline;
        require(block.number > sessionDeadline, "Session not past deadline");
        require(!session.isSessionDone, "Session cannot be finalized");
        require(sessionDeadline != 0, "Session not started");

        uint256 contributorsN;
        bytes32 resultHash;

        uint256 max;
        bytes32 agreedBlockSpecimenHash;
        bytes32 agreedResultHash;

        bytes32[] storage blockSpecimenHashesRaw = session.blockSpecimenHashesRaw;
        bytes32 rawBlockSpecimenHash;
        uint256 blockSpecimenHashesLength = blockSpecimenHashesRaw.length;

        for (uint256 i = 0; i < blockSpecimenHashesLength; i++) {
            rawBlockSpecimenHash = blockSpecimenHashesRaw[i];
            BlockSpecimenProperties storage bh = session.blockSpecimenProperties[rawBlockSpecimenHash];
            for (uint256 j = 0; j < bh.resultHashes.length; j++) {
                resultHash = bh.resultHashes[j];
                uint256 len = bh.participants[resultHash].length;
                contributorsN += len;
                if (len > max) {
                    max = len;
                    agreedBlockSpecimenHash = rawBlockSpecimenHash;
                    agreedResultHash = resultHash;
                }
            }
        }

        // check if the number of submissions is sufficient and if the quorum is achieved
        if (_minSubmissionsRequired <= max && (max * _DIVIDER) / contributorsN >= _blockResultQuorum) {
            _finalizeWithParticipants(session, chainId, blockHeight, agreedBlockSpecimenHash, agreedResultHash);
        } else emit QuorumNotReached(chainId, blockHeight);

        // prevent further session finalization calls
        session.isSessionDone = true;
        session.sessionDeadline = 0;
    }

    function _finalizeWithParticipants(BlockResultSession storage session, uint64 chainId, uint64 blockHeight, bytes32 agreedBlockSpecimenHash, bytes32 agreedResultHash) internal {
        address[] storage participants = session.blockSpecimenProperties[agreedBlockSpecimenHash].participants[agreedResultHash];
        uint256 validatorBitMap; // sets the ith bit to 1 if the ith validator submits the agreed result hash

        mapping(address => SessionParticipantData) storage participantsData = session.participantsData;

        for (uint256 i = 0; i < participants.length; i++) {
            address participant = participants[i];
            SessionParticipantData storage pd = participantsData[participant];
            validatorBitMap |= (1 << (255 - validatorIDs[participant]));
            // release gas if possible
            if (pd.submissionCounter > 0) {
                pd.submissionCounter = 0;
            }
        }

        emit BlockResultQuorum(chainId, blockHeight, validatorBitMap, agreedBlockSpecimenHash, agreedResultHash);

        // release gas
        // clear blockSpecimenProperties map
        for (uint256 i = 0; i < session.blockSpecimenHashesRaw.length; i++) {
            bytes32 key = session.blockSpecimenHashesRaw[i];
            BlockSpecimenProperties storage blockSpecimenProperty = session.blockSpecimenProperties[key];

            for (uint256 j = 0; j < blockSpecimenProperty.resultHashes.length; j++) {
                bytes32 resultHash = blockSpecimenProperty.resultHashes[j];

                address[] memory participantsTemp = blockSpecimenProperty.participants[resultHash];
                for (uint256 k = 0; k < participantsTemp.length; k++) {
                    delete session.participantsData[participantsTemp[k]];
                }

                delete blockSpecimenProperty.participants[resultHash];
            }

            delete session.blockSpecimenProperties[key];
        }

        delete session.blockSpecimenHashesRaw;
    }

    /**
     * Returns contract meta data
     */
    function getMetadata()
        public
        view
        returns (
            address stakingManager,
            uint128 blockResultRewardAllocation,
            uint64 blockResultSessionDuration,
            uint64 minSubmissionsRequired,
            uint256 blockResultQuorum,
            uint256 secondsPerBlockCurrentChain
        )
    {
        return (address(_stakingManager), _blockResultRewardAllocation, _blockResultSessionDuration, _minSubmissionsRequired, _blockResultQuorum, _secondsPerBlockCurrentChain);
    }

    /**
     * Returns data used for chain sync
     */
    function getChainData(
        uint64 chainId
    )
        external
        view
        returns (
            uint256 blockOnTargetChain,
            uint256 blockOnCurrentChain,
            uint256 secondsPerBlockTargetChain,
            uint128 allowedThreshold,
            uint128 maxSubmissionsPerBlockHeight,
            uint64 nthBlock
        )
    {
        ChainData memory cd = _chainData[chainId];
        return (cd.blockOnTargetChain, cd.blockOnCurrentChain, cd.secondsPerBlockTargetChain, cd.allowedThreshold, cd.maxSubmissionsPerBlockHeight, cd.nthBlock);
    }

    /**
     * Returns all brp operator addresses (disabled and enabled) of a given validator
     */
    function getOperators(uint128 validatorId) external view returns (address[] memory) {
        return _validatorOperators[validatorId].values();
    }

    /**
     * Returns all enabled operators by role type
     */
    function getAllOperators() external view returns (address[] memory _brps, address[] memory __governors, address[] memory __auditors) {
        return (_blockResultProducers.values(), _governors.values(), _auditors.values());
    }

    /**
     * returns enabled operator count for a validator
     */
    function getEnabledOperatorCount(uint128 validatorId) external view returns (uint128) {
        return _validatorActiveOperatorsCounters[validatorId];
    }

    /**
     * Returns required stake and enabled block result producer operators
     */
    function getBRPRoleData() external view returns (uint128 requiredStake, address[] memory activeMembers) {
        return (_brpRequiredStake, _blockResultProducers.values());
    }

    /**
     * Returns true if the given operator is enabled.
     * Returns false if the operator is disabled or does not exist
     */
    function isEnabled(address operator) external view returns (bool) {
        return _blockResultProducers.contains(operator);
    }

    /**
     * Returns true if the given validator is enabled.
     * Returns false if the validator is disabled or does not exist
     */
    function isValidatorEnabled(uint128 validatorId) external view returns (bool) {
        return _validatorEnabled[validatorId];
    }

    /**
     * Returns IPFS urls where results reside
     */
    function getURLS(bytes32 resulthash) external view returns (string[] memory) {
        return _urls[resulthash];
    }

    /**
     * This function is called to check whether the sesion is open for the given chain id and block height
     */
    function isSessionOpen(uint64 chainId, uint64 blockHeight, address operator) public view returns (bool) {
        BlockResultSession storage session = _sessions[chainId][blockHeight];
        uint64 sessionDeadline = session.sessionDeadline;
        SessionParticipantData storage participantsData = session.participantsData[operator];
        bool submissionLimitExceeded = participantsData.submissionCounter == _chainData[chainId].maxSubmissionsPerBlockHeight;
        return (!submissionLimitExceeded && block.number <= sessionDeadline) || (sessionDeadline == 0 && !session.isSessionDone);
    }

    function _isValidResultHash(bytes32 resultHash) internal pure returns (bool) {
        bytes32 zeroHash = bytes32(0);
        // Check if the input is a valid hash
        require(resultHash != zeroHash, "Invalid result hash");
        return true;
    }

    function _isValidSpecimenHash(bytes32 specimenHash) internal pure returns (bool) {
        bytes32 zeroHash = bytes32(0);
        // Check if the input is a valid hash
        require(specimenHash != zeroHash, "Invalid specimen hash");
        return true;
    }

    function _isValidStorageURL(string memory storageURL) internal pure returns (bool) {
        // Check if the input is not an empty string
        return bytes(storageURL).length > 0;
    }
}
