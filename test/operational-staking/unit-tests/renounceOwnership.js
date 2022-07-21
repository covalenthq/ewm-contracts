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
  it('Should not change the owner if owner is renounced.', async function() {
    const [
      opManager,
      contract,
      cqtContract,
      validator1,
      validator2,
      delegator1,
      delegator2,
    ] = await getAll();
    const owner = await contract.connect(opManager).owner()
    await contract.connect(opManager).renounceOwnership()
    const owner2 = await contract.connect(opManager).owner()
    expect(owner).to.equal(owner2)

    await contract.connect(opManager).setMaxCapMultiplier(23);
  });


});
