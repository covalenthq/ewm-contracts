const {
    setupDefaultOperators
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests remove governor', function() {
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
      await proofChain.connect(owner).addGovernor(delegators[0].address);
      await proofChain.connect(owner).removeGovernor(delegators[0].address);
      await proofChain.connect(owner).addGovernor(delegators[0].address);
    });

    it('Emits OperatorRemoved', async function() {
        await proofChain.connect(owner).addGovernor(delegators[0].address);
      await expect(proofChain.connect(owner).removeGovernor(delegators[0].address))
          .to.emit(proofChain, 'OperatorRemoved')
          .withArgs(delegators[0].address);
    });

    it('Does not let a non-owner role call remove governor', async function() {
      await expect(
          proofChain.connect(operators[0]).removeGovernor(operators[validator1ID].address),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await proofChain.connect(owner).addGovernor(delegators[0].address);
      await expect(proofChain.connect(validators[0]).removeGovernor(operators[validator1ID].address))
      .to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('Should revert when trying to remove an governor that does not exist or has a different role', async function() {
        await proofChain.connect(owner).addGovernor(delegators[0].address);
        await expect(proofChain
            .connect(owner)
            .removeGovernor(validators[0].address)).to.be.revertedWith('Operator is not governor');

            await expect(proofChain
                .connect(owner)
                .removeGovernor(delegators[1].address)).to.be.revertedWith('Operator is not governor');

      });

  });
