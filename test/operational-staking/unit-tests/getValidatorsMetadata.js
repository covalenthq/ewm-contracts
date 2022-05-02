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

describe('Get validators from start id to end id metadata', function() {
  it('Should return correct validator addresses', async function() {
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
    let md = await contract.getValidatorsMetadata(0, 1);
    expect(md.addresses[0]).to.equal(VALIDATOR_1);
    expect(md.commissionRates[0]).to.equal(100);

    await addEnabledValidator(1, contract, opManager, VALIDATOR_1, 200);
    md = await contract.getValidatorsMetadata(1, 2);
    expect(md.addresses[0]).to.equal(VALIDATOR_1);
    expect(md.commissionRates[0]).to.equal(200);

    await addEnabledValidator(2, contract, opManager, VALIDATOR_2, oneToken.sub(1));
    md = await contract.getValidatorsMetadata(2, 3);
    expect(md.addresses[0]).to.equal(VALIDATOR_2);
    expect(md.commissionRates[0]).to.equal(oneToken.sub(1));

    await addEnabledValidator(3, contract, opManager, DELEGATOR_2, 900000);
    md = await contract.getValidatorsMetadata(3, 4);
    expect(md.addresses[0]).to.equal(DELEGATOR_2);
    expect(md.commissionRates[0]).to.equal(900000);

    md = await contract.getValidatorsMetadata(0, 4);
    expect(md.addresses.length).to.equal(4)

    expect(md.addresses[0]).to.equal(VALIDATOR_1);
    expect(md.addresses[1]).to.equal(VALIDATOR_1);
    expect(md.addresses[2]).to.equal(VALIDATOR_2);
    expect(md.addresses[3]).to.equal(DELEGATOR_2);


    expect(md.commissionRates.length).to.equal(4)

    expect(md.commissionRates[0]).to.equal(100);
    expect(md.commissionRates[1]).to.equal(200);
    expect(md.commissionRates[2]).to.equal(oneToken.sub(1));
    expect(md.commissionRates[3]).to.equal(900000);

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
    let md = await contract.getValidatorsMetadata(0, 1);
    expect(md.staked[0]).to.equal(oneToken);

    await stake(oneToken, validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);
    md = await contract.getValidatorsMetadata(0, 1);
    expect(md.staked[0]).to.equal(oneToken.mul(202));
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
    md = await contract.getValidatorsMetadata(0, 1);
    expect(md.delegated[0]).to.equal(oneToken.mul(100));

    await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
    await stake(oneToken.mul(400), delegator1, cqtContract, contract, 0);
    md = await contract.getValidatorsMetadata(0, 1);
    expect(md.delegated[0]).to.equal(oneToken.mul(500));
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
    md = await contract.getValidatorsMetadata(0, 1);
    expect(md.disabledAtBlocks[0]).to.equal(1);

    await contract.connect(opManager).enableValidator(0);
    await contract.connect(opManager).disableValidator(0, 87646);
    md = await contract.getValidatorsMetadata(0, 1);
    expect(md.disabledAtBlocks[0]).to.equal(87646);
  });
});
