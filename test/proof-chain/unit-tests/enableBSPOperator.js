const {
    setupWithDefaultParameters,
    oneToken,
  } = require('../../fixtures.js');
  const {expect} = require('chai');

  describe('Tests startOperatorRole()', function() {

    beforeEach(async function() {
      [contractsAndAccounts, parameters] = await setupWithDefaultParameters();
      [owner,
      stakingContract,
      cqtContract,
      proofChain,
      validators,
      operators,
      delegators,
    ] = contractsAndAccounts;

    commissionRate = BigInt(10 ** 17);
    stakeAmount = oneToken.mul(150);

    for (i = 0; i < validators.length; i++) {
      validator = validators[i];
      operator = operators[i];

      await proofChain.connect(owner).addValidator(validator.address, commissionRate);
      await cqtContract.connect(validator).approve(stakingContract.address, stakeAmount);
      await stakingContract.connect(validator).stake(i, stakeAmount);
      await proofChain.connect(owner).addBSPOperator(operators[i].address, i);
    }

    validator1ID = 0;
    validator2ID = 1;
    validator3ID = 2;
    });


    it('Lets a validator enable an operator if the validator is preapproved', async function() {
      await proofChain.connect(validators[0]).enableBSPOperator(operators[0].address,);
    });

    it('Reverts when an operator enables an operator if the validator is preapproved', async function() {
        await expect(
            proofChain
                .connect(operators[0])
                .enableBSPOperator(
                    operators[0].address,
                ),
        ).to.be.revertedWith('Sender is not operator manager');
      });

      it('Reverts when a non-validator enables an operator', async function() {
        await expect(
            proofChain
                .connect(delegators[0])
                .enableBSPOperator(
                    operators[0].address,
                ),
        ).to.be.revertedWith('Sender is not operator manager');
      });


    it('Emits OperatorEnabled event', async function() {
      await expect(
          proofChain
              .connect(validators[0])
              .enableBSPOperator(
                  operators[0].address,
              ),
      )
          .to.emit(proofChain, 'OperatorEnabled')
          .withArgs(
              operators[0].address
          );
    });


    it('Does not let a validatorID be used by a different validator', async function() {
      await expect(
          proofChain
              .connect(validators[0])
              .enableBSPOperator(
                  operators[1].address,
              ),
      ).to.be.revertedWith('Sender is not operator manager');

      await expect(
        proofChain
            .connect(validators[1])
            .enableBSPOperator(
                operators[0].address,
            ),
      ).to.be.revertedWith('Sender is not operator manager');

    });

    it('Does not let enable an operator that does not exist or performs a different role', async function() {
      validatorID = 0;

      await expect(proofChain.connect(validators[validatorID]).enableBSPOperator(validators[validatorID].address)
        ).to.be.revertedWith('Operator does not perform the requested role');

    await proofChain.connect(owner).addAuditor(delegators[0].address)

    await expect(proofChain.connect(validators[0]).enableBSPOperator( delegators[0].address),
        ).to.be.revertedWith('Operator does not perform the requested role');

      await proofChain.connect(owner).removeBSPOperator(operators[validatorID].address);

      await expect(
          proofChain
              .connect(validators[validatorID])
              .enableBSPOperator(
                  operators[validatorID].address,
              ),
      ).to.be.revertedWith('Operator does not perform the requested role');
    });


    it('Does not let enable an enabled operator', async function() {
     await proofChain.connect(validators[0]).enableBSPOperator(operators[0].address)

      await expect(
          proofChain
              .connect(validators[0])
              .enableBSPOperator(
                  operators[0].address
              ),
      ).to.be.revertedWith('Operator is already enabled');
    });

    it('Should return true when called isEnabled ', async function() {
        await proofChain.connect(validators[0]).enableBSPOperator(operators[0].address)

        expect(await proofChain.isEnabled(operators[0].address)
         ).to.be.equal(true);
       });

    it('Should enable validator with correct block number', async function() {
       await expect(
            proofChain.connect(validators[0]).enableBSPOperator( operators[0].address))
        .to.emit(stakingContract, 'ValidatorEnabled')
        .withArgs(0);
       });

    it('Should not enable a validator when it is already enabled ', async function() {
        await proofChain.connect(owner).addBSPOperator(delegators[0].address, 0)
        await proofChain.connect(validators[0]).enableBSPOperator(operators[0].address)
        await expect(
         proofChain
             .connect(validators[0])
             .enableBSPOperator(
                delegators[0].address,
             ))
         .to.not.emit(stakingContract, 'ValidatorEnabled')
        });

       it('Should add operator to active operators', async function() {
        expect((await proofChain.getAllOperators())._bsps).to.not.contain(operators[0].address)
        await proofChain.connect(validators[0]).enableBSPOperator(operators[0].address)
        expect((await proofChain.getAllOperators())._bsps).to.contain(operators[0].address)
       });



  });


