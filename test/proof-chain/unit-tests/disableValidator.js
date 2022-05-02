const {getAllWithProofchain} = require('../../fixtures.js');
const {expect} = require('chai');

describe('Tests disableValidator()', function() {

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

    await stakingContract.connect(owner).setStakingManagerAddress(proofChain.address);

    commissionRate = 10;
    blockNumber = 123;
  });

  it('Lets a governance role disable a validator after they are added', async function() {
    await proofChain.connect(owner).addValidator(validators[0].address, commissionRate);
    await proofChain.connect(owner).addValidator(validators[1].address, commissionRate);
    await proofChain.connect(owner).addValidator(validators[2].address, commissionRate);

    await proofChain.connect(owner).disableValidator(0, blockNumber);
    await proofChain.connect(owner).disableValidator(1, blockNumber);
    await proofChain.connect(owner).disableValidator(2, blockNumber);
  });

  it('Emits ValidatorDisabled when a validator is disabled', async function() {
    await proofChain.connect(owner).addValidator(validators[0].address, commissionRate);

    await expect(proofChain.connect(owner).disableValidator(0, blockNumber))
        .to.emit(stakingContract, 'ValidatorDisabled')
        .withArgs(0, blockNumber);
  });

  it('Reverts when non-governance tries to disable a validator', async function() {
    await proofChain.connect(owner).addValidator(validators[0].address, commissionRate);

    await expect(
        proofChain
            .connect(delegators[0])
            .disableValidator(0, blockNumber),
    ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
  });
});
