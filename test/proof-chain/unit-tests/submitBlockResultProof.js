
const {
    setupDefaultOperators,
    oneToken,
    mineBlocks,
    getHash
  } = require('../../fixtures.js');
  const {expect} = require('chai');
  const createKeccakHash = require('keccak');

  describe('Tests submitBlockResultProof()', function() {
    chainId = 1;
    blockHeight = 123;
    specimenSize = 15;
    specimenLength = 1;
    storageURL = 'example.com';
    specimenHash = getHash('main specimen')
    altHash = getHash('alternate specimen')

    beforeEach(async function() {
      [contractsAndAccounts, parameters] = await setupDefaultOperators();

      [
        owner,
        contract,
        cqtContract,
        proofChain,
        validators,
        operators,
        delegators,
      ] = contractsAndAccounts;

      for(let i = 0; i<operators.length; i++){
        await proofChain.connect(owner).removeBSPOperator(operators[i].address);
        await proofChain.connect(owner).addBRPOperator(operators[i].address, i);
        await proofChain.connect(validators[i]).enableBRPOperator(operators[i].address);
      }

      await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%

      numOperators = operators.length;
      quorumThreshold = Math.floor(
          (numOperators *
          ((await proofChain
              .connect(owner).getMetadata())
              .blockResultQuorum)) /
          10 ** 18,
      );
      sessionDuration = (await proofChain
          .connect(owner)
          .getMetadata())
          .blockResultSessionDuration;

    });

    it('Lets a BRP role submit a specimen proof', async function() {
      await expect(proofChain
          .connect(operators[0])
          .submitBlockResultProof(
              chainId,
              blockHeight,
              specimenHash,
              specimenHash,
              storageURL,
          )
          )
          .to.emit(proofChain, 'BlockResultProductionProofSubmitted');

          await expect(proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )
              )
              .to.emit(proofChain, 'BlockResultProductionProofSubmitted');

      await expect(proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight+1,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )
              )
              .to.emit(proofChain, 'BlockResultProductionProofSubmitted');

      await expect(proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight+1,
                  altHash,
                  specimenHash,
                  storageURL,
              )
              )
              .to.emit(proofChain, 'BlockResultProductionProofSubmitted');
    });

    it('Reverts when a non-BRP submits a specimen proof', async function() {
      await expect(
          proofChain
              .connect(delegators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      ).to.be.revertedWith('Sender is not BLOCK_RESULT_PRODUCER_ROLE');
    });

    it('Reverts when invalid chain ID is provided', async function() {
        await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  99,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      ).to.be.revertedWith('Invalid chain ID');
    });


    it('Emits BlockResultProductionProofSubmitted event with correct args', async function() {
      await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  altHash,
                  specimenHash,
                  storageURL,
              ),
      )
          .to.emit(proofChain, 'BlockResultProductionProofSubmitted')
          .withArgs(
              chainId,
              blockHeight,
              altHash,
              specimenHash,
              storageURL,
              oneToken.mul(150)
          );
    });

    it('Reverts when trying to submit out of bounds of live sync', async function() {
      const secondsPerBlockTargetChain = 5
      const secondsPerBlockCurrentChain = 10
      const startCurrent = 10
      const startTarget = 10
      const threshold = 20
      await proofChain.connect(owner).setChainSyncData(chainId, startTarget, startCurrent, secondsPerBlockTargetChain)
      await proofChain.connect(owner).setSecondsPerBlock(secondsPerBlockCurrentChain)
      await proofChain.connect(owner).setBlockHeightSubmissionsThreshold(chainId, threshold)
      let res = await proofChain.connect(owner).setMaxSubmissionsPerBlockHeight(chainId, 3)

      let blocksDiff = res.blockNumber - startCurrent
      let secondsDiff = blocksDiff * secondsPerBlockCurrentChain
      let blocksTargetDiff = secondsDiff/secondsPerBlockTargetChain

      let currentTargetBlockNumber = startTarget + blocksTargetDiff


      await expect(proofChain
          .connect(operators[1])
          .submitBlockResultProof(
              chainId,
              currentTargetBlockNumber,
              specimenHash,
              specimenHash,
              storageURL,
          )
          )
          .to.emit(proofChain, 'BlockResultProductionProofSubmitted');

      await expect(
                  proofChain
                      .connect(operators[1])
                      .submitBlockResultProof(
                          chainId,
                          currentTargetBlockNumber + threshold*2,
                          specimenHash,
                          specimenHash,
                          storageURL,
                      ),
                      ).to.be.revertedWith('Block height is out of bounds for live sync');

      });



      it('Should revert when attempt to submit after session has closed (reached its deadline)', async function() {
          await proofChain.connect(owner).setSessionDuration(10);
          await
              proofChain
                  .connect(operators[1])
                  .submitBlockResultProof(
                      chainId,
                      blockHeight,
                      specimenHash,
                      specimenHash,
                      storageURL,
                  )

          await mineBlocks(10)

          await expect(
              proofChain
                  .connect(operators[2])
                  .submitBlockResultProof(
                      chainId,
                      blockHeight,
                      specimenHash,
                      altHash,
                      storageURL,
                  ),
          ).to.be.revertedWith('Session submissions have closed');
        });

        it('Should revert when attempt to submit after session has closed reached its deadline and being finalized', async function() {
          await proofChain.connect(owner).setSessionDuration(10);
          await
              proofChain
                  .connect(operators[1])
                  .submitBlockResultProof(
                      chainId,
                      blockHeight,
                      specimenHash,
                      specimenHash,
                      storageURL,
                  )


          await mineBlocks(10)

          await
              proofChain
                  .connect(operators[1])
                  .finalizeAndRewardBlockResultSession(
                      chainId,
                      blockHeight
                  )

          await expect(
              proofChain
                  .connect(operators[2])
                  .submitBlockResultProof(
                      chainId,
                      blockHeight,
                      specimenHash,
                      altHash,
                      storageURL,
                  ),
          ).to.be.revertedWith('Session submissions have closed');
        });


    it('Should revert when attempt to submit specimen hash for the same block height and block hash twice', async function() {

      await
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              )

      await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  specimenHash,
                  specimenHash,
                  storageURL,
              ),
      ).to.be.revertedWith('Operator already submitted for the provided block hash');

      await expect(
        proofChain
            .connect(operators[1])
            .submitBlockResultProof(
                chainId,
                blockHeight,
                specimenHash,
                altHash,
                storageURL,
            ),
    ).to.be.revertedWith('Operator already submitted for the provided block hash');
    });

    it('Should revert when attempt to submit when operator did not stake sufficiently when session has not been started', async function() {
      await proofChain.connect(owner).setBRPRequiredStake( oneToken.mul(151))
      await expect(
          proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  altHash,
                  altHash,
                  storageURL,
              ),
          ).to.be.revertedWith('Insufficiently staked to submit');
  });

  it('Should revert when attempt to submit when operator did not stake sufficiently when session has already been started', async function() {
      await proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  altHash,
                  altHash,
                  storageURL,
              )
      await proofChain.connect(owner).setBRPRequiredStake( oneToken.mul(151))
      await expect(
          proofChain
              .connect(operators[1])
              .submitBlockResultProof(
                  chainId,
                  blockHeight,
                  altHash,
                  altHash,
                  storageURL,
              ),
          ).to.be.revertedWith('Insufficiently staked to submit');
  });

    it('Does same block height on different chain IDs without collision', async function() {
      await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%
      await proofChain.connect(owner).setNthBlock(42, 1)
      await  proofChain.connect(owner).setChainSyncData(42, 1, 1, 1)
      await  proofChain.connect(owner).setMaxSubmissionsPerBlockHeight(42, 3)
      await proofChain.connect(owner).setBlockHeightSubmissionsThreshold(42, 100000000)


      chainId = 1;
      otherChainId = 42;

      for (i = 0; i < numOperators; i++) {
        await expect(
            proofChain
                .connect(operators[i])
                .submitBlockResultProof(
                    chainId,
                    blockHeight,
                    specimenHash,
                    specimenHash,
                    storageURL,
                ),
        )
            .to.emit(proofChain, 'BlockResultProductionProofSubmitted')

          await expect(
              proofChain
                  .connect(operators[i])
                  .submitBlockResultProof(
                      otherChainId,
                      blockHeight,
                      specimenHash,
                      specimenHash,
                      storageURL,
                  ),
          )
              .to.emit(proofChain, 'BlockResultProductionProofSubmitted')
      }
    });


    it('Reverts when trying to submit for invalid block height', async function() {
      await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%
      await proofChain.connect(owner).setNthBlock(1, 2)

      chainId = 1;
      otherChainId = 42;

      await expect(
        proofChain
            .connect(operators[0])
            .submitBlockResultProof(
                chainId,
                1,
                altHash,
                altHash,
                storageURL,
            ),
        ).to.be.revertedWith('Invalid block height');

        await expect(
          proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  9871284391,
                  altHash,
                  altHash,
                  storageURL,
              ),
          ).to.be.revertedWith('Invalid block height');


        await proofChain.connect(owner).setNthBlock(1, 10)


        await expect(
          proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  9871284391,
                  altHash,
                  altHash,
                  storageURL,
              ),
          ).to.be.revertedWith('Invalid block height');
    });


    it('Reverts when trying to submit more than max number of submissions allowed per block height', async function() {
      await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%
      await proofChain.connect(owner).setNthBlock(1, 1)
      await proofChain.connect(owner).setMaxSubmissionsPerBlockHeight(1, 3)

      chainId = 1;
      otherChainId = 42;

      await proofChain
            .connect(operators[0])
            .submitBlockResultProof(
                chainId,
                1,
                specimenHash,
                altHash,
                storageURL,
            )

        await proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  1,
                  altHash,
                  altHash,
                  storageURL,
              )



        await proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  1,
                  getHash("1"),
                  altHash,
                  storageURL,
              )


          await expect(
            proofChain
                .connect(operators[0])
                .submitBlockResultProof(
                    chainId,
                    1,
                    getHash("12"),
                    altHash,
                    storageURL,
                ),
            ).to.be.revertedWith('Max submissions limit exceeded');
    });


    it('Reverts when trying to submit for the same block hash per block height twice', async function() {
      await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%
      await proofChain.connect(owner).setNthBlock(1, 1)
      await proofChain.connect(owner).setMaxSubmissionsPerBlockHeight(1, 4)


      chainId = 1;
      otherChainId = 42;

      await proofChain
            .connect(operators[0])
            .submitBlockResultProof(
                chainId,
                1,
                specimenHash,
                altHash,
                storageURL,
            )

        await proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  1,
                  altHash,
                  altHash,
                  storageURL,
              )


        await proofChain
              .connect(operators[0])
              .submitBlockResultProof(
                  chainId,
                  1,
                  getHash("1"),
                  altHash,
                  storageURL,
              )


          await expect(
            proofChain
                .connect(operators[0])
                .submitBlockResultProof(
                    chainId,
                    1,
                    getHash("1"),
                    altHash,
                    storageURL,
                ),
            ).to.be.revertedWith('Operator already submitted for the provided block hash');
    });

  });
