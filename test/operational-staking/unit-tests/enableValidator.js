const {expect} = require('chai');

const {
  getAll,
  getDeployedContract,
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
  mineBlocks,
  addEnabledValidator,
} = require('../../fixtures');

describe('Enable validator', function() {
  it('Should be able to call stake after validator got enabled after being disabled.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0);
    await contract.connect(opManager).disableValidator(0, 1000);
    await contract.connect(opManager).enableValidator(0);
    expect(await stake(oneToken, validator1, cqtContract, contract, 0))
        .to.emit(contract, 'Staked')
        .withArgs(0, VALIDATOR_1, oneToken);
    expect(await stake(oneToken, delegator1, cqtContract, contract, 0))
        .to.emit(contract, 'Staked')
        .withArgs(0, delegator1.address, oneToken);
  });

  it('Should emit event with correct validator and disabled block.', async function() {
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
    await contract.connect(opManager).disableValidator(0, 1456788);
    expect(await contract.connect(opManager).enableValidator(0))
        .to.emit(contract, 'ValidatorEnabled')
        .withArgs(0);
  });

  it('Should return correct disabled block.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.addValidator(VALIDATOR_1, oneToken.div(10));
    await contract.connect(opManager).enableValidator(0);
    let details = await contract.getValidatorMetadata(0);
    expect(details.disabledAtBlock).to.equal(0);
    await contract.connect(opManager).disableValidator(0, 1456788);
    await contract.connect(opManager).enableValidator(0);
    details = await contract.getValidatorMetadata(0);
    expect(details.disabledAtBlock).to.equal(0);
  });

  it('Should revert when enabling invalid validator id.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    expect(contract.connect(opManager).enableValidator(0))
    .to.revertedWith('Invalid validator');
    deposit(contract, oneToken.mul(100000));
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await stake(oneToken.mul(1000000), validator1, cqtContract, contract, 0);
    mineBlocks(10);
    expect(contract.connect(opManager).enableValidator(1))
    .to.revertedWith('Invalid validator');
  });


});
