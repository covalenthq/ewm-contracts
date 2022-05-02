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

const threshold = ethers.BigNumber.from('10000000000000000');

describe('Set validator commission rate', function() {
  it('Should change validator commission rate.', async function() {
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

    await contract.setValidatorCommissionRate(0, 50000000);
    let detailsTwo = await contract.getValidatorMetadata(0);
    let newCommissionRate = detailsTwo.commissionRate;
    expect(newCommissionRate).to.equal(50000000);

    await contract.setValidatorCommissionRate(0, 1000000);
    detailsTwo = await contract.getValidatorMetadata(0);
    newCommissionRate = detailsTwo.commissionRate;
    expect(newCommissionRate).to.equal(1000000);

    await contract.setValidatorCommissionRate(0, 1);
    detailsTwo = await contract.getValidatorMetadata(0);
    newCommissionRate = detailsTwo.commissionRate;

    expect(newCommissionRate).to.equal(1);
    await stake(oneToken.mul(1000), validator1, cqtContract, contract, 0);
  });

  it('Should emit ValidatorCommissionRateChanged event with correct validator id and amount.', async function() {
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
    expect(await contract.setValidatorCommissionRate(0, 12345678))
        .to.emit(contract, 'ValidatorCommissionRateChanged')
        .withArgs(0, 12345678);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    expect(await contract.setValidatorCommissionRate(1, 1))
        .to.emit(contract, 'ValidatorCommissionRateChanged')
        .withArgs(1, 1);
  });

  it('Should emit correct amount of validator commission rewards.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();

    await deposit(contract, oneToken.mul(1000));

    const percentTen = oneToken.div(10);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, percentTen);
    const vStake = oneToken.mul(1000);
    const dStake = oneToken.mul(10);
    await stake(vStake, validator1, cqtContract, contract, 0);
    await stake(dStake, validator2, cqtContract, contract, 0);
    const emitted = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [emitted]);
    let vData = await contract.getDelegatorMetadata(validator1.address, 0);
    let dData = await contract.getDelegatorMetadata(validator2.address, 0);

    let commissionEmitted = emitted.mul(percentTen).div(oneToken);
    expect(vData.commissionEarned).to.equal(commissionEmitted);
    expect(dData.commissionEarned).to.equal(0);

    const percentTwenty = percentTen.mul(2);
    await contract.setValidatorCommissionRate(0, percentTwenty);
    await contract.connect(opManager).rewardValidators([0], [emitted]);
    commissionEmitted = emitted
        .mul(percentTwenty)
        .div(oneToken)
        .add(commissionEmitted);
    vData = await contract.getDelegatorMetadata(validator1.address, 0);
    dData = await contract.getDelegatorMetadata(validator2.address, 0);

    expect(vData.commissionEarned).to.equal(commissionEmitted);
    expect(dData.commissionEarned).to.equal(0);
  });

  it('Should emit correct amount of delegator rewards.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();

    await deposit(contract, oneToken.mul(1000));

    const percentTen = oneToken.div(10);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, percentTen);
    const vStake = oneToken.mul(1000);
    const dStake = oneToken.mul(10);
    await stake(vStake, validator1, cqtContract, contract, 0);
    await stake(dStake, validator2, cqtContract, contract, 0);
    const emitted = oneToken.mul(100);
    await contract.connect(opManager).rewardValidators([0], [emitted]);
    let vData = await contract.getDelegatorMetadata(validator1.address, 0);
    let dData = await contract.getDelegatorMetadata(validator2.address, 0);

    let commissionEmitted = emitted.mul(percentTen).div(oneToken);
    let rewardEmitted = emitted.sub(commissionEmitted);
    let vRew = rewardEmitted.mul(vStake).div(vStake.add(dStake));
    let dRew = rewardEmitted.mul(dStake).div(vStake.add(dStake));
    expect(vData.rewards).to.be.closeTo(vRew, threshold);
    expect(dData.rewards).to.be.closeTo(dRew, threshold);

    const percentTwenty = percentTen.mul(2);
    await contract.setValidatorCommissionRate(0, percentTwenty);
    await contract.connect(opManager).rewardValidators([0], [emitted]);

    commissionEmitted = emitted.mul(percentTwenty).div(oneToken);
    rewardEmitted = emitted.sub(commissionEmitted);
    vData = await contract.getDelegatorMetadata(validator1.address, 0);
    dData = await contract.getDelegatorMetadata(validator2.address, 0);

    vRew = rewardEmitted.mul(vStake).div(vStake.add(dStake)).add(vRew);
    dRew = rewardEmitted.mul(dStake).div(vStake.add(dStake)).add(dRew);

    expect(vData.rewards).to.be.closeTo(vRew, threshold);
    expect(dData.rewards).to.be.closeTo(dRew, threshold);
  });

  it('Should revert with invalid validator id.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await expect(contract.setValidatorCommissionRate(0, 0)).to.revertedWith(
        'Invalid validator',
    );
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await expect(
        contract.setValidatorCommissionRate(50000000, 0),
    ).to.revertedWith('Invalid validator');
    await expect(
        contract.setValidatorCommissionRate(1000000, 0),
    ).to.revertedWith('Invalid validator');
    await expect(contract.setValidatorCommissionRate(1, 0)).to.revertedWith(
        'Invalid validator',
    );
  });

  it('Should revert if set to >= 10^18.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    await addEnabledValidator(0, contract, opManager, VALIDATOR_2, 10);
    const message = 'Rate must be less than 100%';
    await expect(
        contract.setValidatorCommissionRate(0, oneToken),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(0, oneToken.add(1)),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(0, oneToken.mul(1000000)),
    ).to.revertedWith(message);
    await deposit(contract, oneToken.mul(1000));
    await expect(
        contract.setValidatorCommissionRate(0, oneToken),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(0, oneToken.add(1)),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(0, oneToken.mul(1000000)),
    ).to.revertedWith(message);
    await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 10);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken.add(1)),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken.mul(1000000)),
    ).to.revertedWith(message);
    await stake(oneToken.mul(100), validator1, cqtContract, contract, 1);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken.add(1)),
    ).to.revertedWith(message);
    await expect(
        contract.setValidatorCommissionRate(1, oneToken.mul(1000000)),
    ).to.revertedWith(message);
  });
});
