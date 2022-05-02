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

describe('Add Validator', function() {
  it('Should change validators number.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    // deposit(contract, oneToken.mul(100000))
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    let validatorsN = await getValidatorsN(contract);
    expect(validatorsN).to.equal(1);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_2, 20);
    await addEnabledValidator(0, contract, opManager, DELEGATOR_2, 20);
    validatorsN = await getValidatorsN(contract);
    expect(validatorsN).to.equal(3);
  });

  it('Should emit event  with correct validator and commission rate.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const res = await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_1,
        10,
    );
    expect(res)
        .to.emit(contract, 'ValidatorAdded')
        .withArgs(0, '10', VALIDATOR_1);
  });

  it('Should add validator with correct commission rate.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    let details = await contract.getValidatorMetadata(0);
    expect(details.commissionRate).to.equal(10);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_2, 120000);
    await addEnabledValidator(0, contract, opManager, DELEGATOR_2, 5000000);
    details = await contract.getValidatorMetadata(1);
    expect(details.commissionRate).to.equal(120000);
    details = await contract.getValidatorMetadata(2);
    expect(details.commissionRate).to.equal(5000000);
  });

  it('Should add validator with correct address.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    let details = await contract.getValidatorMetadata(0);
    expect(details._address).to.equal(VALIDATOR_1);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_2, 120000);
    await addEnabledValidator(0, contract, opManager, DELEGATOR_2, 5000000);
    details = await contract.getValidatorMetadata(1);
    expect(details._address).to.equal(VALIDATOR_2);
    details = await contract.getValidatorMetadata(2);
    expect(details._address).to.equal(DELEGATOR_2);
  });
});
