const {expect} = require('chai');
const {
  getAll,
  getDeployedContract,
  getRewardsLocked,
  getAllocatedTokensPerEpoch,
  getEndEpoch,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Set staking manager address', function() {
  it('Should change staking manager address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setStakingManagerAddress(OPERATOR_1);
    let sManager = (await contract.getMetadata())._stakingManager;
    expect(OPERATOR_1).to.equal(sManager);
    await contract.setStakingManagerAddress(OPERATOR_2);
    sManager = (await contract.getMetadata())._stakingManager;
    expect(OPERATOR_2).to.equal(sManager);
  });

  it('Should emit StakingManagerAddressChanged event with correct address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    expect(await contract.setStakingManagerAddress(OPERATOR_1))
        .to.emit(contract, 'StakingManagerAddressChanged')
        .withArgs(OPERATOR_1);
    expect(await contract.setStakingManagerAddress(OPERATOR_2))
        .to.emit(contract, 'StakingManagerAddressChanged')
        .withArgs(OPERATOR_2);
  });
});
