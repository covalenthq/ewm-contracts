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

describe('Get validator metadata', function() {
  it('Should return correct validator address', async function() {
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
    let md = await contract.getValidatorMetadata(0);
    expect(md._address).to.equal(VALIDATOR_1);

    await addEnabledValidator(1, contract, opManager, VALIDATOR_1, 20);
    md = await contract.getValidatorMetadata(1);
    expect(md._address).to.equal(VALIDATOR_1);

    await addEnabledValidator(2, contract, opManager, VALIDATOR_2, 20);
    md = await contract.getValidatorMetadata(2);
    expect(md._address).to.equal(VALIDATOR_2);
    await addEnabledValidator(3, contract, opManager, DELEGATOR_2, 20);
    md = await contract.getValidatorMetadata(3);
    expect(md._address).to.equal(DELEGATOR_2);
  });

  it('Should return correct validator commission rate', async function() {
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
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
    let md = await contract.getValidatorMetadata(0);
    expect(md.commissionRate).to.equal(100);

    await addEnabledValidator(1, contract, opManager, VALIDATOR_1, 200);
    md = await contract.getValidatorMetadata(1);
    expect(md.commissionRate).to.equal(200);

    await addEnabledValidator(
        0,
        contract,
        opManager,
        VALIDATOR_2,
        oneToken.sub(1),
    );
    md = await contract.getValidatorMetadata(2);
    expect(md.commissionRate).to.equal(oneToken.sub(1));
    await addEnabledValidator(0, contract, opManager, DELEGATOR_2, 900000);
    md = await contract.getValidatorMetadata(3);
    expect(md.commissionRate).to.equal(900000);
  });

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
    // deposit(contract, oneToken.mul(100000))
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
    await stake(oneToken, validator1, cqtContract, contract, 0);
    let md = await contract.getValidatorMetadata(0);
    expect(md.staked).to.equal(oneToken);

    await stake(oneToken, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);
    md = await contract.getValidatorMetadata(0);
    expect(md.staked).to.equal(oneToken.mul(202));
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
    // deposit(contract, oneToken.mul(100000))
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
    await stake(oneToken, validator1, cqtContract, contract, 0);

    await stake(oneToken, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);
    md = await contract.getValidatorMetadata(0);
    expect(md.delegated).to.equal(oneToken.mul(100));

    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(400), delegator1, cqtContract, contract, 0);
    md = await contract.getValidatorMetadata(0);
    expect(md.delegated).to.equal(oneToken.mul(500));
  });

  it('Should return correct disabled at block number', async function() {
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
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
    await contract.connect(opManager).disableValidator(0, 1);
    md = await contract.getValidatorMetadata(0);
    expect(md.disabledAtBlock).to.equal(1);

    await contract.connect(opManager).enableValidator(0);
    await contract.connect(opManager).disableValidator(0, 87646);
    md = await contract.getValidatorMetadata(0);
    expect(md.disabledAtBlock).to.equal(87646);
  });
});
