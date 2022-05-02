const {expect} = require('chai');
const {
  getAll,
  impersonateAll,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  CQT_ETH_MAINNET,
  getOwner,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  deposit,
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Initialize contract', function() {
  it('Should emit Initialized event with correct args.', async function() {
    await impersonateAll();
    const owner = await getOwner();
    const staking = await ethers.getContractFactory(
        'OperationalStaking',
        owner,
    );
    const contract = await upgrades.deployProxy(
        staking,
        [CQT_ETH_MAINNET, 1, 2, 3, 4], // delegatorCoolDown, validatorCoolDown, maxCapMultiplier, vMaxStakeCap],
        {initializer: 'initialize'},
    );
    const stakingContract = await contract.deployed();
    // emit Initialized(cqt, vCoolDown, dCoolDown, maxCapM, vMaxStake);
    expect(contract.deployTransaction)
        .to.emit(contract, 'Initialized')
        .withArgs(CQT_ETH_MAINNET, 2, 1, 3, 4);
  });
});
