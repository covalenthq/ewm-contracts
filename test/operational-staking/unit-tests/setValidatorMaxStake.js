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

describe('Set validator max stake', function() {
  it('Should change validator max stake amount.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.setValidatorMaxStake(oneToken.mul(560));
    let maxStake = (await contract.getMetadata())._validatorMaxStake;
    expect(maxStake).to.equal(oneToken.mul(560));

    await contract.setValidatorMaxStake(oneToken.mul(48000));
    maxStake = (await contract.getMetadata())._validatorMaxStake;
    expect(maxStake).to.equal(oneToken.mul(48000));
  });

  it('Should emit ValidatorMaxCapChanged event with correct amount.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    expect(await contract.setValidatorMaxStake(oneToken.mul(9000)))
        .to.emit(contract, 'ValidatorMaxCapChanged')
        .withArgs(oneToken.mul(9000));
    expect(await contract.setValidatorMaxStake(oneToken))
        .to.emit(contract, 'ValidatorMaxCapChanged')
        .withArgs(oneToken);
  });
});
