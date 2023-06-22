// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./IOperationalStaking.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract BlockResultProofChain is OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    IOperationalStaking _stakingInterface; // staking contract

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant BLOCK_RESULT_PRODUCER_ROLE = keccak256("BLOCK_RESULT_PRODUCER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    uint256 private constant _DIVIDER = 10 ** 18; // 18 decimals used for scaling

    uint256 private _blockResultQuorum; // The value is represented as a uint <= 10**18. The threshold value will later be divided by 10**18 to represent it as a percentage.  e.g.) 10**18 == 100%; 5 * 10**17 == 50%;
    uint256 private _secondsPerBlock; // average block time on the chain where the ProofChain is deployed
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

    struct ChainData {
        uint256 blockOnTargetChain; // block number on the chain for which BRP are produced which is mapped to the current chain block
        uint256 blockOnCurrentChain; // block number on the chain where the ProofChain is deployed. it is mapped to the target chain block
        uint256 secondsPerBlock; // average block time on the chain for which BRP is generated
        uint128 allowedThreshold; // block offsett threshold, used to handle minor de-synchronization over time
        uint128 maxSubmissionsPerBlockHeight; // max number of block hashes allowed to submit per block height
        uint64 nthBlock; // block divisor
    }

    struct BlockSpecimenHash {
        mapping(bytes32 => address[]) participants; // result hash => operators who submitted the result hash
        bytes32[] resultHashes; // raw result hashes
    }

    struct SessionParticipantData {
        uint128 stake; // stake at the time when an operator submitted the first result hash
        uint128 submissionCounter; // how many result hashes an operator has submitted
    }

    struct BlockResultSession {
        mapping(bytes32 => BlockSpecimenHash) blockSpecimenHashes;
        bytes32[] blockSpecimenHashesRaw;
        mapping(address => SessionParticipantData) participantsData; // stake and submission counter, pack these together to save gas
        uint64 sessionDeadline; // the last block when an operator can submit a result hash
        bool requiresAudit; // auditor can arbitrate the session only if this is set to true
    }

    event OperatorAdded(address operator, uint128 validatorId, bytes32 role);

    event OperatorRemoved(address operator);

    event OperatorEnabled(address operator);

    event OperatorDisabled(address operator);

    event BlockResultProductionProofSubmitted(
        uint64 chainId,
        uint64 blockHeight,
        bytes32 blockSpecimenHash,
        bytes32 resultHash, // SHA-256 content-hash of result object file;
        string storageURL, // URL of result storage
        uint128 submittedStake
    );

    event SessionStarted(uint64 indexed chainId, uint64 indexed blockHeight, uint64 deadline);

    event BlockResultRewardAwarded(uint64 indexed chainId, uint64 indexed blockHeight, bytes32 indexed blockSpecimenHash, bytes32 resulthash);

    event QuorumNotReached(uint64 indexed chainId, uint64 blockHeight);

    event BlockResultRewardChanged(uint128 newBlockResultRewardAllocation);

    event MinimumRequiredStakeChanged(uint128 newStakeRequirement);

    event StakingInterfaceChanged(address newInterfaceAddress);

    event ResultSessionQuorumChanged(uint256 newQuorumThreshold);

    event ResultSessionDurationChanged(uint64 newSessionDuration);

    event ResultSessionMinSubmissionChanged(uint64 minSubmissions);

    event NthBlockChanged(uint64 indexed chainId, uint64 indexed nthBlock);

    event MaxSubmissionsPerBlockHeightChanged(uint256 maxSubmissions);

    event ChainSyncDataChanged(uint64 indexed chainId, uint256 blockOnTargetChain, uint256 blockOnCurrentChain, uint256 secondsPerBlock);

    event SecondsPerBlockChanged(uint64 indexed secondsPerBlock);

    event BlockHeightSubmissionThresholdChanged(uint64 indexed chainId, uint64 threshold);

    modifier onlyGovernor() {
        require(_governors.contains(msg.sender), "Sender is not GOVERNANCE_ROLE");
        _;
    }

    /**
     * Operators will have multiple addresses: the address they submit the proofs from and the address that manages staking and operator instances
     */
    modifier onlyOperatorManager(address operator) {
        (address validatorAddress, , , ) = _stakingInterface.getValidatorMetadata(validatorIDs[operator]);
        require(validatorAddress == msg.sender, "Sender is not operator manager");
        _;
    }

    function initialize(address initialOwner, address stakingContract) public initializer {
        __Ownable_init();

        _governors.add(msg.sender);

        _roleNames.add(GOVERNANCE_ROLE);
        _roleNames.add(BLOCK_RESULT_PRODUCER_ROLE);
        _roleNames.add(AUDITOR_ROLE);

        setQuorumThreshold(_DIVIDER / 2); // 50%
        setBlockResultReward(10 ** 14); // 0.0001
        setBlockResultSessionDuration(240); // blocks
        setMinSubmissionsRequired(2);
        setStakingInterface(stakingContract);
        _governors.remove(msg.sender);

        operatorRoles[initialOwner] = GOVERNANCE_ROLE;
        _governors.add(initialOwner);
        emit OperatorAdded(initialOwner, 0, GOVERNANCE_ROLE);
    }

    /**
     * Adds operator on the staking contract
     */
    function addValidator(address validator, uint128 commissionRate) external onlyGovernor {
        _stakingInterface.addValidator(validator, commissionRate);
    }

    /**
     * Disables the given operator on the staking contract
     */
    function disableValidator(uint128 validatorId, uint256 blockNumber) external onlyGovernor {
        _stakingInterface.disableValidator(validatorId, blockNumber);
    }

    /**
     * Disables the operator instance.
     * If all addresses of the operator are disabled, then the operator (validator) instance will get disabled on the staking contract
     */
    function _removeBRPOperatorFromActiveInstances(address operator) internal {
        _blockResultProducers.remove(operator);
        uint128 validatorId = validatorIDs[operator];
        _validatorActiveOperatorsCounters[validatorId]--;
        // if there are not more enabled operators left we need to disable the validator instance too
        if (_validatorActiveOperatorsCounters[validatorId] == 0) _stakingInterface.disableValidator(validatorId, block.number);
    }

    /**
     * Enables the operator instance. The operators need to call that function before they can start submitting proofs
     */
    function enableBRPOperator(address operator) external onlyOperatorManager(operator) {
        require(operatorRoles[operator] == BLOCK_RESULT_PRODUCER_ROLE, "Operator is not BRP");
        require(!_blockResultProducers.contains(operator), "Operator is already enabled");
        uint128 validatorId = validatorIDs[operator];
        _blockResultProducers.add(operator);
        _validatorActiveOperatorsCounters[validatorId]++;
        // if no operator was enabled we need to enable the validator instance
        if (_validatorActiveOperatorsCounters[validatorId] == 1) _stakingInterface.enableValidator(validatorId);
        emit OperatorEnabled(operator);
    }

    /**
     * Disables the operator instance. The operator cannot submit proofs its instance got disabled.
     * If all addresses of the operator are disabled, then the operator (validator) instance will get disabled on the staking contract
     */
    function disableBRPOperator(address operator) external onlyOperatorManager(operator) {
        require(operatorRoles[operator] == BLOCK_RESULT_PRODUCER_ROLE, "Operator is not BRP");
        require(_blockResultProducers.contains(operator), "Operator is already disabled");
        _removeBRPOperatorFromActiveInstances(operator);
        emit OperatorDisabled(operator);
    }

    /**
     * Adds the given address to the block result producers set
     */
    function addBRPOperator(address operator, uint128 validatorId) external onlyGovernor {
        require(operatorRoles[operator] == 0, "Operator already exists");
        operatorRoles[operator] = BLOCK_RESULT_PRODUCER_ROLE;
        validatorIDs[operator] = validatorId;
        _validatorOperators[validatorId].add(operator);
        emit OperatorAdded(operator, validatorId, BLOCK_RESULT_PRODUCER_ROLE);
    }

    /**
     * Removes the given address from the block result producers set
     */
    function removeBRPOperator(address operator) external onlyGovernor {
        require(operatorRoles[operator] == BLOCK_RESULT_PRODUCER_ROLE, "Operator is not BRP");
        if (_blockResultProducers.contains(operator)) _removeBRPOperatorFromActiveInstances(operator);
        _validatorOperators[validatorIDs[operator]].remove(operator);
        validatorIDs[operator] = 0;
        operatorRoles[operator] = 0;
        emit OperatorRemoved(operator);
    }

    /**
     * Adds the given address to the auditors set
     */
    function addAuditor(address auditor) external onlyGovernor {
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
        emit OperatorRemoved(auditor);
    }

    /**
     * Adds the given address to the governors set
     */
    function addGovernor(address governor) external onlyOwner {
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
        emit OperatorRemoved(governor);
    }

    /**
     * Updates the amount of tokens required to stake in order to be able to submit the proofs
     */
    function setBRPRequiredStake(uint128 newStakeAmount) public onlyGovernor {
        _brpRequiredStake = newStakeAmount;
        emit MinimumRequiredStakeChanged(newStakeAmount);
    }

    /**
     * Updates the address of the staking contract
     */
    function setStakingInterface(address stakingContractAddress) public onlyGovernor {
        _stakingInterface = IOperationalStaking(stakingContractAddress);
        emit StakingInterfaceChanged(stakingContractAddress);
    }

    /**
     * Update the Block Result Quorum Threshold.
     */
    function setQuorumThreshold(uint256 quorum) public onlyGovernor {
        _blockResultQuorum = quorum;
        emit ResultSessionQuorumChanged(quorum);
    }

    /**
     * Update block divisor
     */
    function setNthBlock(uint64 chainId, uint64 n) public onlyGovernor {
        _chainData[chainId].nthBlock = n;
        emit NthBlockChanged(chainId, n);
    }

    /**
     * Update the reward allocation per block result.
     */
    function setBlockResultReward(uint128 newBlockResultReward) public onlyGovernor {
        _blockResultRewardAllocation = newBlockResultReward;
        emit BlockResultRewardChanged(newBlockResultReward);
    }

    /**
     * Update the duration of a result session in blocks
     */
    function setBlockResultSessionDuration(uint64 newSessionDuration) public onlyGovernor {
        _blockResultSessionDuration = newSessionDuration;
        emit ResultSessionDurationChanged(newSessionDuration);
    }

    /**
     * Update the minimum # of submissions required in order to reach quorum
     */
    function setMinSubmissionsRequired(uint64 minSubmissions) public onlyGovernor {
        _minSubmissionsRequired = minSubmissions;
        emit ResultSessionMinSubmissionChanged(minSubmissions);
    }

    /**
     * Update the max # of submissions per operator per block height
     */
    function setMaxSubmissionsPerBlockHeight(uint64 chainId, uint64 maxSubmissions) public onlyGovernor {
        _chainData[chainId].maxSubmissionsPerBlockHeight = maxSubmissions;
        emit MaxSubmissionsPerBlockHeightChanged(maxSubmissions);
    }

    /**
     * Update chain sync data
     */
    function setChainSyncData(uint64 chainId, uint256 blockOnTargetChain, uint256 blockOnCurrentChain, uint256 secondsPerBlock) external onlyGovernor {
        ChainData storage cd = _chainData[chainId];
        require(secondsPerBlock > 0, "Seconds per block cannot be 0");
        cd.blockOnTargetChain = blockOnTargetChain;
        cd.blockOnCurrentChain = blockOnCurrentChain;
        cd.secondsPerBlock = secondsPerBlock;
        emit ChainSyncDataChanged(chainId, blockOnTargetChain, blockOnCurrentChain, secondsPerBlock);
    }

    /**
     * Update block height submission threshold for live sync
     */
    function setBlockHeightSubmissionsThreshold(uint64 chainId, uint64 threshold) external onlyGovernor {
        _chainData[chainId].allowedThreshold = threshold;
        emit BlockHeightSubmissionThresholdChanged(chainId, threshold);
    }

    /**
     * Update seconds per block on the chain where the ProofChain is deployed
     */
    function setSecondsPerBlock(uint64 secondsPerBlock) external onlyGovernor {
        _secondsPerBlock = secondsPerBlock;
        emit SecondsPerBlockChanged(secondsPerBlock);
    }

    /**
     * Block Result Producers submit their block result proofs using this function.
     */
    function submitBlockResultProof(uint64 chainId, uint64 blockHeight, bytes32 blockSpecimenHash, bytes32 resultHash, string calldata storageURL) external {
        require(_blockResultProducers.contains(msg.sender), "Sender is not BLOCK_RESULT_PRODUCER_ROLE");
        ChainData storage cd = _chainData[chainId];
        require(cd.nthBlock != 0, "Invalid chain ID");
        require(blockHeight % cd.nthBlock == 0, "Invalid block height");

        BlockResultSession storage session = _sessions[chainId][blockHeight];
        uint64 sessionDeadline = session.sessionDeadline;
        SessionParticipantData storage participantsData = session.participantsData[msg.sender];

        // if this is the first result to be submitted for a block, initialize a new session
        if (sessionDeadline == 0) {
            require(!session.requiresAudit, "Session submissions have closed");

            uint256 currentBlockOnTargetChain = cd.blockOnTargetChain + (((block.number - cd.blockOnCurrentChain) * _secondsPerBlock) / cd.secondsPerBlock);
            uint256 lowerBound = currentBlockOnTargetChain >= cd.allowedThreshold ? currentBlockOnTargetChain - cd.allowedThreshold : 0;
            require(lowerBound <= blockHeight && blockHeight <= currentBlockOnTargetChain + cd.allowedThreshold, "Block height is out of bounds for live sync");

            session.sessionDeadline = uint64(block.number + _blockResultSessionDuration);
            (uint128 baseStake, uint128 delegateStakes) = _stakingInterface.getValidatorCompoundedStakingData(validatorIDs[msg.sender]);
            require(baseStake >= _brpRequiredStake, "Insufficiently staked to submit");
            participantsData.stake = baseStake + delegateStakes;

            session.blockSpecimenHashesRaw.push(blockSpecimenHash);
            BlockSpecimenHash storage bh = session.blockSpecimenHashes[blockSpecimenHash];
            bh.resultHashes.push(resultHash);

            bh.participants[resultHash].push(msg.sender);
            participantsData.submissionCounter++;
            emit SessionStarted(chainId, blockHeight, session.sessionDeadline);
        } else {
            require(block.number <= sessionDeadline, "Session submissions have closed");
            require(participantsData.submissionCounter < cd.maxSubmissionsPerBlockHeight, "Max submissions limit exceeded");

            BlockSpecimenHash storage bh = session.blockSpecimenHashes[blockSpecimenHash];
            bytes32[] storage resultHashes = bh.resultHashes;
            if (participantsData.stake != 0) {
                // check if it was submitted for the same block hash
                // this should be at most 10 iterations
                for (uint256 j = 0; j < resultHashes.length; j++) {
                    address[] storage resultHashParticipants = bh.participants[resultHashes[j]];
                    for (uint256 k = 0; k < resultHashParticipants.length; k++)
                        require(resultHashParticipants[k] != msg.sender, "Operator already submitted for the provided block hash");
                }
            } else {
                (uint128 baseStake, uint128 delegateStakes) = _stakingInterface.getValidatorCompoundedStakingData(validatorIDs[msg.sender]);
                require(baseStake >= _brpRequiredStake, "Insufficiently staked to submit");
                participantsData.stake = baseStake + delegateStakes;
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

        emit BlockResultProductionProofSubmitted(chainId, blockHeight, blockSpecimenHash, resultHash, storageURL, participantsData.stake);
    }

    /**
     * This function is called when a quorum of equivalent hashes have been submitted for a Block Result Session.
     */
    function finalizeAndRewardResultSession(uint64 chainId, uint64 blockHeight) public {
        BlockResultSession storage session = _sessions[chainId][blockHeight];
        uint64 sessionDeadline = session.sessionDeadline;
        require(block.number > sessionDeadline, "Session not past deadline");
        require(!session.requiresAudit, "Session cannot be finalized");
        require(sessionDeadline != 0, "Session not started");

        uint256 contributorsN;
        bytes32 resultHash;

        uint256 max;
        bytes32 agreedBlockSpecimenHash;
        bytes32 agreedResultHash;

        bytes32[] storage blockSpecimenHashesRaw = session.blockSpecimenHashesRaw;
        bytes32 rawBlockSpecimenHash;

        // find the block hash and result hashes that the quorum agrees on by finding the result hash with the highest number of participants
        for (uint256 i = 0; i < blockSpecimenHashesRaw.length; i++) {
            rawBlockSpecimenHash = blockSpecimenHashesRaw[i];
            BlockSpecimenHash storage bh = session.blockSpecimenHashes[rawBlockSpecimenHash];
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
        if (_minSubmissionsRequired <= max && (max * _DIVIDER) / contributorsN > _blockResultQuorum)
            _rewardParticipants(session, chainId, blockHeight, agreedBlockSpecimenHash, agreedResultHash);
        else emit QuorumNotReached(chainId, blockHeight);

        session.requiresAudit = true;
        // set session deadline to 0 to release gas
        session.sessionDeadline = 0;
    }

    /**
     * Called by Auditor role when a quorum is not reached. The auditor's submitted hash is
     * the definitive truth.
     */
    function arbitrateBlockResultSession(uint64 chainId, uint64 blockHeight, bytes32 blockSpecimenHash, bytes32 definitiveResultHash) public {
        require(_auditors.contains(msg.sender), "Sender is not AUDITOR_ROLE");
        BlockResultSession storage session = _sessions[chainId][blockHeight];
        require(session.requiresAudit, "Session must be finalized before audit");
        _rewardParticipants(session, chainId, blockHeight, blockSpecimenHash, definitiveResultHash);
    }

    function _rewardParticipants(BlockResultSession storage session, uint64 chainId, uint64 blockHeight, bytes32 blockSpecimenHash, bytes32 resultHash) internal {
        address participant;
        address[] storage participants = session.blockSpecimenHashes[blockSpecimenHash].participants[resultHash];
        uint256 len = participants.length;
        uint128[] memory ids = new uint128[](len);
        uint128[] memory rewards = new uint128[](len);
        uint128 totalStake;
        mapping(address => SessionParticipantData) storage participantsData = session.participantsData;
        for (uint256 i = 0; i < len; i++) {
            totalStake += participantsData[participants[i]].stake;
        }
        for (uint256 i = 0; i < len; i++) {
            participant = participants[i];
            SessionParticipantData storage pd = participantsData[participant];
            ids[i] = validatorIDs[participant];
            rewards[i] = uint128((uint256(pd.stake) * uint256(_blockResultRewardAllocation)) / totalStake);
            // release gas if possible
            if (pd.submissionCounter == 1) {
                pd.submissionCounter = 0;
                pd.stake = 0;
            }
        }
        _stakingInterface.rewardValidators(ids, rewards);
        emit BlockResultRewardAwarded(chainId, blockHeight, blockSpecimenHash, resultHash);

        delete session.blockSpecimenHashes[blockSpecimenHash]; // release gas
    }

    /**
     * Returns contract meta data
     */
    function getMetadata()
        public
        view
        returns (
            address stakingInterface,
            uint128 blockResultRewardAllocation,
            uint64 blockResultSessionDuration,
            uint64 minSubmissionsRequired,
            uint256 blockResultQuorum,
            uint256 secondsPerBlock
        )
    {
        return (address(_stakingInterface), _blockResultRewardAllocation, _blockResultSessionDuration, _minSubmissionsRequired, _blockResultQuorum, _secondsPerBlock);
    }

    /**
     * Returns data used for chain sync
     */
    function getChainData(
        uint64 chainId
    )
        external
        view
        returns (uint256 blockOnTargetChain, uint256 blockOnCurrentChain, uint256 secondsPerBlock, uint128 allowedThreshold, uint128 maxSubmissionsPerBlockHeight, uint64 nthBlock)
    {
        ChainData memory cd = _chainData[chainId];
        return (cd.blockOnTargetChain, cd.blockOnCurrentChain, cd.secondsPerBlock, cd.allowedThreshold, cd.maxSubmissionsPerBlockHeight, cd.nthBlock);
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
        return (!submissionLimitExceeded && block.number <= sessionDeadline) || (sessionDeadline == 0 && !session.requiresAudit);
    }
}
