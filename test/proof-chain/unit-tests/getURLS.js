const {
    setupDefaultOperators,
    oneToken,
    mineBlocks,
    getHash
} = require('../../fixtures.js');
const { expect } = require('chai');
const createKeccakHash = require('keccak');

describe('Tests submitBlockSpecimenProof()', function () {
    chainId = 1;
    blockHeight = 123;
    specimenSize = 15;
    specimenLength = 1;
    storageURL = 'example.com';
    specimenHash = getHash('main specimen');
    altHash = getHash('alternate specimen');

    beforeEach(async function () {
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

        await proofChain.connect(owner).setQuorumThreshold(BigInt(10 ** 18)); // 100%

        numOperators = operators.length;
        quorumThreshold = Math.floor(
            (numOperators *
                ((await proofChain
                    .connect(owner).getMetadata())
                    .blockSpecimenQuorum)) /
            10 ** 18,
        );
        sessionDuration = (await proofChain
            .connect(owner)
            .getMetadata())
            .blockSpecimenSessionDuration;

    });

    it('Lets a BSP role submit a specimen proof and add matching urls', async function () {
        await expect(proofChain
            .connect(operators[0])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                'e1',
            )
        )
            .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');

        await expect(proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight,
                specimenHash,
                specimenHash,
                'e2',
            )
        )
            .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');

        await expect(proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight + 1,
                specimenHash,
                specimenHash,
                'e3',
            )
        )
            .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');

        await expect(proofChain
            .connect(operators[1])
            .submitBlockSpecimenProof(
                chainId,
                blockHeight + 1,
                altHash,
                specimenHash,
                'e4',
            )
        )
            .to.emit(proofChain, 'BlockSpecimenProductionProofSubmitted');


        let urls = await proofChain.getURLS(specimenHash);
        expect(urls[0]).to.equal('e1');
        expect(urls[1]).to.equal('e2');
        expect(urls[2]).to.equal('e3');
        expect(urls[3]).to.equal('e4');
    });






});
