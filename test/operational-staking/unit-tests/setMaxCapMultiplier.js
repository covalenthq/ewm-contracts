const {expect} = require('chai');
const {ethers} = require('hardhat');

const {
  getAll,
  getDeployedContract,
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

describe('Set max cap multiplier', function() {
  it('Should change max cap multiplier.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await contract.connect(opManager).setMaxCapMultiplier(23);
    let newMultiplier = (await contract.getMetadata())._maxCapMultiplier;
    expect(newMultiplier).to.equal(23);

    await contract.connect(opManager).setMaxCapMultiplier(10);
    newMultiplier = (await contract.getMetadata())._maxCapMultiplier;
    expect(newMultiplier).to.equal(10);

    await contract.connect(opManager).setMaxCapMultiplier(2);
    newMultiplier = (await contract.getMetadata())._maxCapMultiplier;
    expect(newMultiplier).to.equal(2);

    await contract.connect(opManager).setMaxCapMultiplier(1);
    newMultiplier = (await contract.getMetadata())._maxCapMultiplier;
    expect(newMultiplier).to.equal(1);
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
    expect(await contract.connect(opManager).setMaxCapMultiplier(22))
        .to.emit(contract, 'MaxCapMultiplierChanged')
        .withArgs(22);
    expect(await contract.connect(opManager).setMaxCapMultiplier(1))
        .to.emit(contract, 'MaxCapMultiplierChanged')
        .withArgs(1);
    expect(await contract.connect(opManager).setMaxCapMultiplier(212))
        .to.emit(contract, 'MaxCapMultiplierChanged')
        .withArgs(212);
    expect(await contract.connect(opManager).setMaxCapMultiplier(9000))
        .to.emit(contract, 'MaxCapMultiplierChanged')
        .withArgs(9000);
  });

  it('Should be able to delegate more if multiplier increases and should revert when attempted to delegate above max cap.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    deposit(contract, oneToken.mul(10));
    await contract.addValidator(VALIDATOR_1, 10);
    await contract.enableValidator(0);
    const vStaked = oneToken.mul(1000);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
    const initialMultiplier = (await contract.getMetadata())._maxCapMultiplier;
    await expect(
        contract
            .connect(validator2)
            .stake(0, vStaked.mul(initialMultiplier).add(1)),
    ).to.revertedWith('Validator max delegation exceeded');
    const dStaked = vStaked.mul(initialMultiplier);
    await cqtContract.connect(validator2).approve(contract.address, dStaked);
    expect(await contract.connect(validator2).stake(0, dStaked))
        .to.emit(contract, 'Staked')
        .withArgs(0, validator2.address, dStaked);
    await expect(
        contract.connect(validator2).stake(0, oneToken),
    ).to.revertedWith('Validator max delegation exceeded');
    const newMultiplier = initialMultiplier.add(2);
    await contract.setMaxCapMultiplier(newMultiplier);
    const rDelMax = vStaked.mul(newMultiplier).sub(dStaked);
    await expect(
        contract.connect(validator2).stake(0, rDelMax.add(1)),
    ).to.revertedWith('Validator max delegation exceeded');
    await cqtContract.connect(validator2).approve(contract.address, rDelMax);
    expect(await contract.connect(validator2).stake(0, rDelMax))
        .to.emit(contract, 'Staked')
        .withArgs(0, validator2.address, rDelMax);
  });

  it('Should revert if set to 0.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const message = 'Must be greater than 0';
    await expect(contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await deposit(contract, oneToken.mul(1000));
    await expect(contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await contract.addValidator(VALIDATOR_1, 10);
    await contract.enableValidator(0);

    await expect(contract.setMaxCapMultiplier(0)).to.revertedWith(message);
    await stake(oneToken.mul(1), validator1, cqtContract, contract, 0);
    await expect(contract.setMaxCapMultiplier(0)).to.revertedWith(message);
  });
});
