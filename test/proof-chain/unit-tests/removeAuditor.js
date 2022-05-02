const {
    setupDefaultOperators
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests remove auditor', function() {

    beforeEach(async function() {
      [contractsAndAccounts, parameters] = await setupDefaultOperators();

      [
        owner,
        stakingContract,
        cqtContract,
        proofChain,
        validators,
        operators,
        delegators,
      ] = contractsAndAccounts;
      [
        rewardPool,
        maxCapMultiplier,
        maxStakeLimit,
        bspStakeRequired,
        blockSpecimenReward,
        specimenQuorumThreshold,
      ] = parameters;

      validator1ID = 0;
      validator2ID = 1;
      validator3ID = 2;

    });

    it('Lets Governance remove an audior', async function() {
      await proofChain.connect(owner).addAuditor(delegators[0].address);
      await proofChain.connect(owner).removeAuditor(delegators[0].address);
      await proofChain.connect(owner).addAuditor(delegators[0].address);
    });

    it('Emits OperatorRemoved', async function() {
        await proofChain.connect(owner).addAuditor(delegators[0].address);
      await expect(proofChain.connect(owner).removeAuditor(delegators[0].address))
          .to.emit(proofChain, 'OperatorRemoved')
          .withArgs(delegators[0].address);
    });


    it('Does not let a non-governance role call remove auditor', async function() {
      await expect(
          proofChain.connect(operators[0]).removeAuditor(operators[validator1ID].address),
      ).to.be.revertedWith('Sender is not GOVERNANCE_ROLE');

      await proofChain.connect(owner).addAuditor(delegators[0].address);
      await expect(proofChain.connect(delegators[0]).removeAuditor(operators[validator1ID].address))
      .to.be.revertedWith('Sender is not GOVERNANCE_ROLE');
    });


    it('Should revert when trying to remove an auditor that does not exist or has a different role', async function() {
        await proofChain.connect(owner).addAuditor(delegators[0].address);
        await expect(proofChain
            .connect(owner)
            .removeAuditor(validators[0].address)).to.be.revertedWith('Operator is not auditor');

            await expect(proofChain
                .connect(owner)
                .removeAuditor(delegators[1].address)).to.be.revertedWith('Operator is not auditor');

      });


  });
