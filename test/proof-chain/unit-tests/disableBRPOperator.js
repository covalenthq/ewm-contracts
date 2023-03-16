const {
    setupDefaultOperators
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests disable BRP operator', function() {
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
        brpStakeRequired,
        blockSpecimenReward,
        specimenQuorumThreshold,
      ] = parameters;

      validator1ID = 0;
      validator2ID = 1;
      validator3ID = 2;
    });


    it('Lets a validator disable their operator', async function() {
        validatorID = 0;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
        await proofChain
            .connect(validators[validatorID])
            .enableBRPOperator(operators[validatorID].address);

        await proofChain
            .connect(validators[validatorID])
            .disableBRPOperator(operators[validatorID].address);
    });

    it('Does not let a non-validator to disable an operator', async function() {
        await expect(
            proofChain
                .connect(validators[0])
                .disableBRPOperator(operators[1].address),
        ).to.be.revertedWith('Sender is not operator manager');

        await expect(
            proofChain
                .connect(validators[0])
                .disableBRPOperator(operators[1].address),
        ).to.be.revertedWith('Sender is not operator manager');
      });


    it('Emits OperatorDisabled', async function() {
      validatorID = 0;
      await proofChain
          .connect(owner)
          .removeBSPOperator(operators[validatorID].address);
      await proofChain
          .connect(owner)
          .addBRPOperator(operators[validatorID].address, validatorID);
      await proofChain
          .connect(validators[validatorID])
          .enableBRPOperator(operators[validatorID].address);

      await expect(
          proofChain
              .connect(validators[validatorID])
              .disableBRPOperator(operators[validatorID].address),
      )
          .to.emit(proofChain, 'OperatorDisabled')
          .withArgs(
              operators[validatorID].address
          );
    });


    it('Does not let an operator disable an operator ', async function() {
      validatorID = 0;
      await expect(
          proofChain
              .connect(operators[validatorID])
              .disableBRPOperator(operators[validatorID].address),
      ).to.be.revertedWith('Sender is not operator manager');
    });

  it('Does not let a validatorID be used by a different validator', async function() {
    await expect(
        proofChain
            .connect(validators[0])
            .disableBRPOperator(
                operators[1].address,
            ),
    ).to.be.revertedWith('Sender is not operator manager');

    await expect(
      proofChain
          .connect(validators[1])
          .disableBRPOperator(
              operators[0].address,
          ),
    ).to.be.revertedWith('Sender is not operator manager');

  });

  it('Does not let disable an operator that does not exist or performs a different role', async function() {
    validatorID = 0;

    await expect(proofChain.connect(validators[validatorID]).disableBRPOperator(validators[validatorID].address)
      ).to.be.revertedWith('Operator does not perform the requested role');

  await proofChain.connect(owner).addAuditor(delegators[0].address)

  await expect(proofChain.connect(validators[0]).disableBRPOperator( delegators[0].address),
      ).to.be.revertedWith('Operator does not perform the requested role');

      validatorID = 0;
      await proofChain
          .connect(owner)
          .removeBSPOperator(operators[validatorID].address);
      await proofChain
          .connect(owner)
          .addBRPOperator(operators[validatorID].address, validatorID);
      await proofChain
          .connect(validators[validatorID])
          .enableBRPOperator(operators[validatorID].address);

    await proofChain
        .connect(owner)
        .removeBRPOperator(
            operators[validatorID].address,
        );

    await expect(
        proofChain
            .connect(validators[validatorID])
            .disableBRPOperator(
                operators[validatorID].address,
            ),
    ).to.be.revertedWith('Operator does not perform the requested role');
  });


  it('Does not let disable a disabled operator', async function() {
    validatorID = 0;
    await proofChain
        .connect(owner)
        .removeBSPOperator(operators[validatorID].address);
    await proofChain
        .connect(owner)
        .addBRPOperator(operators[validatorID].address, validatorID);
    await proofChain
        .connect(validators[validatorID])
        .enableBRPOperator(operators[validatorID].address);


  await
  proofChain
      .connect(validators[0])
      .disableBRPOperator(
          operators[0].address)

    await expect(
        proofChain
            .connect(validators[0])
            .disableBRPOperator(
                operators[0].address
            ),
    ).to.be.revertedWith('Operator is already disabled');
  });

  it('Should return false when called isEnabled ', async function() {
    validatorID = 0;
    await proofChain
        .connect(owner)
        .removeBSPOperator(operators[validatorID].address);
    await proofChain
        .connect(owner)
        .addBRPOperator(operators[validatorID].address, validatorID);
    await proofChain
        .connect(validators[validatorID])
        .enableBRPOperator(operators[validatorID].address);


        expect( await
           proofChain
               .isEnabled(
                   operators[0].address,
               ),
       ).to.be.equal(true);

       await
       proofChain
           .connect(validators[0])
           .disableBRPOperator(
               operators[0].address)

        expect( await
           proofChain
               .isEnabled(
                   operators[0].address,
               ),
       ).to.be.equal(false);
     });

  it('Should disable validator with correct block number', async function() {
    validatorID = 0;
    await proofChain
        .connect(owner)
        .removeBSPOperator(operators[validatorID].address);
    await proofChain
        .connect(owner)
        .addBRPOperator(operators[validatorID].address, validatorID);
    await proofChain
        .connect(validators[validatorID])
        .enableBRPOperator(operators[validatorID].address);

      let res = await proofChain.connect(validators[0]).disableBRPOperator( operators[0].address)
      expect(res).to.emit(stakingContract, 'ValidatorDisabled').withArgs(0, res.blockNubmer)
     });

  it('Should not disable a validator when there are other enabled operators ', async function() {
      await proofChain.connect(owner).addBRPOperator(delegators[0].address, 0)
      await proofChain
           .connect(validators[0])
           .enableBRPOperator(
              delegators[0].address,
           )

       await expect(
        proofChain
            .connect(validators[0])
            .disableBRPOperator(
               delegators[0].address,
            ))
        .to.not.emit(stakingContract, 'ValidatorDisabled')
      });

     it('Should remove operator from active operators', async function() {
        validatorID = 0;
        await proofChain
            .connect(owner)
            .removeBSPOperator(operators[validatorID].address);
        await proofChain
            .connect(owner)
            .addBRPOperator(operators[validatorID].address, validatorID);
        await proofChain
            .connect(validators[validatorID])
            .enableBRPOperator(operators[validatorID].address);

      expect((await proofChain.getAllOperators())._brps).to.contain(operators[0].address)
      await proofChain.connect(validators[0]).disableBRPOperator(operators[0].address)
      expect((await proofChain.getAllOperators())._brps).to.not.contain(operators[0].address)
     });

});

