const {getAllWithProofchain} = require('../../fixtures.js');
const {expect} = require('chai');

describe('Tests addValidator()', function() {
  beforeEach(async function() {
    [
      owner,
      stakingContract,
      cqtContract,
      proofChain,
      validators,
      operators,
      delegators,
    ] = await getAllWithProofchain();
    await stakingContract
        .connect(owner)
        .setStakingManagerAddress(proofChain.address); // set staking manager
    commissionRate = 10;
  });

  it('Lets a governance role add a new validator to the staking contract', async function() {
    await proofChain
        .connect(owner)
        .addValidator(validators[1].address, commissionRate);
    await proofChain
        .connect(owner)
        .addValidator(validators[2].address, commissionRate);
    await proofChain
        .connect(owner)
        .addValidator(validators[3].address, commissionRate);
  });

  it('Emits ValidatorAdded when a new validator is added to the staking contract', async function() {
    await expect(
        proofChain
            .connect(owner)
            .addValidator(validators[1].address, commissionRate),
    )
        .to.emit(stakingContract, 'ValidatorAdded')
        .withArgs(0, commissionRate, validators[1].address);
  });

  it('Reverts when non-governance tries to add a validator', async function() {
    await expect(
        proofChain
            .connect(operators[1])
            .addValidator(operators[1].address, commissionRate),
    ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
  });
});
