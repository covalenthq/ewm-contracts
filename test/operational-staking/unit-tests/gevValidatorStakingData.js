const {expect} = require('chai');
const {
  getAll,
  getValidatorsN,
  oneToken,
  OWNER,
  VALIDATOR_1,
  VALIDATOR_2,
  OPERATOR_1,
  OPERATOR_2,
  DELEGATOR_1,
  DELEGATOR_2,
  CQT,
  deposit,
  stake,
  addEnabledValidator,
} = require('../../fixtures');

describe('Get validator staking data', function() {
  it('Should return correct # of tokens staked', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        oneToken.div(10),
    );
    await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
    let md = await contract.getValidatorStakingData(0);
    expect(md.staked).to.equal(oneToken.mul(100));

    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

    await contract.rewardValidators([0], [oneToken.mul(120)]);
    md = await contract.getValidatorStakingData(0);
    expect(md.staked).to.equal(oneToken.mul(300));
  });

  it('Should return correct # of tokens delegated', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(1000));
    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        oneToken.div(10),
    );
    await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
    let md = await contract.getValidatorStakingData(0);
    expect(md.staked).to.equal(oneToken.mul(100));

    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

    await contract.rewardValidators([0], [oneToken.mul(120)]);
    md = await contract.getValidatorStakingData(0);
    expect(md.delegated).to.equal(oneToken.mul(100));
  });
});
