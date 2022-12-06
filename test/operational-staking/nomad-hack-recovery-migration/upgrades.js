const { expect } = require('chai');
const {
    getAll,
    oneToken,
    OWNER,
    VALIDATOR_1,
    VALIDATOR_2,
    OPERATOR_1,
    deployStaking,
    OPERATOR_2,
    DELEGATOR_1,
    DELEGATOR_2,
    CQT,
    deposit,
    stake,
    CQT_ETH_MAINNET,
    addEnabledValidator,
    impersonateAll,
    getOwner,
    deployStakingWithDefaultParams,
    getCQTFaucetContract,
    impersonate,
    getSigner,
    giveCQT,
    zero,
    getDelegatorBalances
} = require('../../fixtures');



const defaultAccountsToBurn = [
    "0xe7CCfcc5815131B129c82322B4bA9E10B0159291",
    "0x122F83aE6B1677082F2541686b74Ca55Ebb1B58b",
    "0xdB6ee35DdbA6AB1F39d4a1369104A543e5De0E11",
    "0x128E6bBAa2d269A7D26a3E3AF13Ea86943A05C24",
    "0xa312F7156A2F4290D53e5694afE44e9cC7f1B811"
];

const upgradeToMigrationStaking = async (contract, owner) => {
    const MigrationOperationalStaking = await ethers.getContractFactory('MigrationOperationalStaking', owner);
    upgradedContract = await upgrades.upgradeProxy(contract.address, MigrationOperationalStaking);
    // console.log('Operational Staking upgraded to:', upgradedContract.address);
    return upgradedContract;
};

const upgradeToOriginalStaking = async (contract, owner) => {
    const OperationalStaking = await ethers.getContractFactory('OperationalStaking', owner);
    upgradedContract = await upgrades.upgradeProxy(contract.address, OperationalStaking);
    // console.log('Operational Staking upgraded to:', upgradedContract.address);
    return upgradedContract;
};

const addValidatorAndSelfStake = async (staking, cqtContract, opManager, validator, validatorId) => {
    const availableBalance = await cqtContract.balanceOf(validator.address);

    if (availableBalance.lt(oneToken.mul(10000)))
        await giveCQT(oneToken.mul(10000), validator.address, cqtContract);

    await addEnabledValidator(validatorId, staking, opManager, validator.address, 1000000000000);
    await stake(oneToken.mul(10000), validator, cqtContract, staking, validatorId);
};

const getScaledAmountsSum = (amounts) => amounts.reduce(
    (previousValue, currentValue) => previousValue.add(oneToken.mul(currentValue)),
    zero()
);

const stakeToValidators = async (ids, amounts, staking, delegator, cqtContract) => {
    const sumAmounts = getScaledAmountsSum(amounts);
    const availableBalance = await cqtContract.balanceOf(delegator.address);

    if (availableBalance.lt(sumAmounts))
        await giveCQT(sumAmounts, delegator.address, cqtContract);

    for (let index = 0; index < amounts.length; index++) {
        await stake(oneToken.mul(amounts[index]), delegator, cqtContract, staking, ids[index]);
    }
};


describe('Initialize contract', function () {
    it('Should upgrade to migration contract and back to original', async function () {
        const owner = await getOwner();
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
        await contract.connect(opManager).addValidator(VALIDATOR_1, 1000000000000);
        await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0);

        const MigrationOperationalStaking = await ethers.getContractFactory('MigrationOperationalStaking', owner);
        const s2 = await upgrades.upgradeProxy(contract.address, MigrationOperationalStaking);
        console.log('Operational Staking upgraded to:', s2.address);
        await expect(await s2.owner()).to.equal(owner.address);

        const OperationalStaking = await ethers.getContractFactory('OperationalStaking', owner);
        const s3 = await upgrades.upgradeProxy(s2.address, OperationalStaking);
        console.log('Operational Staking upgraded to:', s3.address);
        await expect(await s3.owner()).to.equal(owner.address);
    }
    );

    it('Should change CQT address in between', async function () {
        const owner = await getOwner();
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
        await contract.connect(opManager).addValidator(VALIDATOR_1, 1000000000000);
        await stake(oneToken.mul(10000), validator1, cqtContract, contract, 0);
        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);

        const newCQTFaucet = await getCQTFaucetContract(owner);
        const newCQT = newCQTFaucet.address;
        await migrationStaking.setCQTAddress(newCQT);
        await expect((await migrationStaking.getMetadata()).CQTaddress).to.equal(newCQT);

        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);
        await expect((await newOriginalStaking.getMetadata()).CQTaddress).to.equal(newCQT);
    }
    );

    it('Should change virtual CQT balances of default accounts', async function () {
        const owner = await getOwner();
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();

        const deposited = oneToken.mul(1000);
        await deposit(contract, deposited);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);
        const selfStaked = oneToken.mul(10000).mul(5);

        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        const d1 = await getSigner(defaultAccountsToBurn[0]);
        const d2 = await getSigner(defaultAccountsToBurn[1]);
        const d3 = await getSigner(defaultAccountsToBurn[2]);
        const d4 = await getSigner(defaultAccountsToBurn[3]);
        const d5 = await getSigner(defaultAccountsToBurn[4]);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, d5, 4);

        const unscaledStakesD1 = [100, 10, 20, 90, 1];
        const unscaledStakesD2 = [20, 200, 5, 80, 2];
        const unscaledStakesD3 = [5, 11, 10, 5, 3];
        const unscaledStakesD4 = [1, 14, 12, 2, 4];
        const unscaledStakesD5 = [17, 16, 120, 2, 70];

        const validatorIds = [0, 1, 2, 3, 4];

        await stakeToValidators(validatorIds, unscaledStakesD1, contract, d1, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD2, contract, d2, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD3, contract, d3, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD4, contract, d4, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD5, contract, d5, cqtContract);

        let r1 = await getDelegatorBalances(contract, d1.address);
        let sum1 = getScaledAmountsSum(unscaledStakesD1);
        expect(r1.sum).to.equal(sum1);

        let sum2 = getScaledAmountsSum(unscaledStakesD2);
        let r2 = await getDelegatorBalances(contract, d2.address);
        expect(r2.sum).to.equal(sum2);

        let sum3 = getScaledAmountsSum(unscaledStakesD3);
        let r3 = await getDelegatorBalances(contract, d3.address);
        expect(r3.sum).to.equal(sum3);

        let sum4 = getScaledAmountsSum(unscaledStakesD4);
        let r4 = await getDelegatorBalances(contract, d4.address);
        expect(r4.sum).to.equal(sum4);

        let sum5 = getScaledAmountsSum(unscaledStakesD5);
        let r5 = await getDelegatorBalances(contract, d5.address);
        expect(r5.sum).to.equal(sum5.add(oneToken.mul(10000)));

        const expectedBalance = sum1.add(sum2).add(sum3).add(sum4.add(sum5)).add(deposited).add(selfStaked);
        expect(await cqtContract.balanceOf(contract.address)).to.equal(expectedBalance.toString());

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);
        await migrationStaking.connect(owner).burnDefaultDelegators();

        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);

        r1 = await getDelegatorBalances(newOriginalStaking, d1.address);
        expect(r1.sum).to.equal(0);

        r2 = await getDelegatorBalances(newOriginalStaking, d2.address);
        expect(r2.sum).to.equal(0);

        r3 = await getDelegatorBalances(newOriginalStaking, d3.address);
        expect(r3.sum).to.equal(0);

        r4 = await getDelegatorBalances(newOriginalStaking, d4.address);
        expect(r4.sum).to.equal(0);

        r5 = await getDelegatorBalances(newOriginalStaking, d5.address);
        expect(r5.sum).to.equal(oneToken.mul(10070));
    }
    );

    it('Should change virtual CQT balances of given accounts', async function () {
        const owner = await getOwner();
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();

        const deposited = oneToken.mul(1000);
        await deposit(contract, deposited);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);
        const selfStaked = oneToken.mul(10000).mul(4);

        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        const d1 = await getSigner(defaultAccountsToBurn[0]);
        const d2 = await getSigner(defaultAccountsToBurn[1]);
        const d3 = await getSigner(defaultAccountsToBurn[2]);
        const d4 = await getSigner(defaultAccountsToBurn[3]);

        const unscaledStakesD1 = [100, 10, 20];
        const unscaledStakesD2 = [20, 200, 5];
        const unscaledStakesD3 = [5, 11, 10];
        const unscaledStakesD4 = [1, 14, 12];

        const validatorIds = [0, 1, 2, 3];

        await stakeToValidators(validatorIds, unscaledStakesD1, contract, d1, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD2, contract, d2, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD3, contract, d3, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD4, contract, d4, cqtContract);

        let r1 = await getDelegatorBalances(contract, d1.address);
        let sum1 = getScaledAmountsSum(unscaledStakesD1);
        expect(r1.sum).to.equal(sum1);

        let sum2 = getScaledAmountsSum(unscaledStakesD2);
        let r2 = await getDelegatorBalances(contract, d2.address);
        expect(r2.sum).to.equal(sum2);

        let sum3 = getScaledAmountsSum(unscaledStakesD3);
        let r3 = await getDelegatorBalances(contract, d3.address);
        expect(r3.sum).to.equal(sum3);

        let sum4 = getScaledAmountsSum(unscaledStakesD4);
        let r4 = await getDelegatorBalances(contract, d4.address);
        expect(r4.sum).to.equal(sum4);


        const expectedBalance = sum1.add(sum2).add(sum3).add(sum4).add(deposited).add(selfStaked);
        expect(await cqtContract.balanceOf(contract.address)).to.equal(expectedBalance.toString());

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);

        await migrationStaking.connect(owner).burnDelegatorBalance(0, d1.address);
        await migrationStaking.connect(owner).burnDelegatorBalance(1, d2.address);
        await migrationStaking.connect(owner).burnDelegatorBalance(2, d3.address);
        await migrationStaking.connect(owner).burnDelegatorBalance(2, d4.address);

        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);

        r1 = await getDelegatorBalances(newOriginalStaking, d1.address);
        expect(r1.sum).to.equal(sum1.sub(oneToken.mul(unscaledStakesD1[0])));

        r2 = await getDelegatorBalances(newOriginalStaking, d2.address);
        expect(r2.sum).to.equal(sum2.sub(oneToken.mul(unscaledStakesD2[1])));

        r3 = await getDelegatorBalances(newOriginalStaking, d3.address);
        expect(r3.sum).to.equal(sum3.sub(oneToken.mul(unscaledStakesD3[2])));

        r4 = await getDelegatorBalances(newOriginalStaking, d4.address);
        expect(r4.sum).to.equal(sum4.sub(oneToken.mul(unscaledStakesD4[2])));
    }
    );

    it('Should change CQT balance of the contract to 0 and increase the recipient balance to the correct value', async function () {
        const owner = await getOwner();
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();

        const deposited = oneToken.mul(1000);
        await deposit(contract, deposited);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);
        const selfStaked = oneToken.mul(10000).mul(4);

        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        const d1 = await getSigner(defaultAccountsToBurn[0]);
        const d2 = await getSigner(defaultAccountsToBurn[1]);
        const d3 = await getSigner(defaultAccountsToBurn[2]);
        const d4 = await getSigner(defaultAccountsToBurn[3]);

        const unscaledStakesD1 = [100, 10, 20];
        const unscaledStakesD2 = [20, 200, 5];
        const unscaledStakesD3 = [5, 11, 10];
        const unscaledStakesD4 = [1, 14, 12];

        const validatorIds = [0, 1, 2, 3];

        await stakeToValidators(validatorIds, unscaledStakesD1, contract, d1, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD2, contract, d2, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD3, contract, d3, cqtContract);
        await stakeToValidators(validatorIds, unscaledStakesD4, contract, d4, cqtContract);

        let sum1 = getScaledAmountsSum(unscaledStakesD1);
        let sum2 = getScaledAmountsSum(unscaledStakesD2);
        let sum3 = getScaledAmountsSum(unscaledStakesD3);
        let sum4 = getScaledAmountsSum(unscaledStakesD4);

        const expectedBalance = sum1.add(sum2).add(sum3).add(sum4).add(deposited).add(selfStaked);
        expect(await cqtContract.balanceOf(contract.address)).to.equal(expectedBalance.toString());

        const oldOwnerBalance = await cqtContract.balanceOf(owner.address);

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);
        await migrationStaking.connect(owner).withdrawAllMadCQT(owner.address);

        const expectedNewOwnerBalance = oldOwnerBalance.add(expectedBalance);
        expect(await cqtContract.balanceOf(migrationStaking.address)).to.equal(0);
        expect(await cqtContract.balanceOf(owner.address)).to.equal(expectedNewOwnerBalance);

        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);
        expect(await cqtContract.balanceOf(newOriginalStaking.address)).to.equal(0);
        expect(await cqtContract.balanceOf(owner.address)).to.equal(expectedNewOwnerBalance);
    }
    );




    it('Should not access withdrawMadCQT, burnDefaultBalances, setCQTAddress, renounceOwnership by not owner.', async function () {
        const [
            opManager,
            originalContrtact,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();

        const contract = await upgradeToMigrationStaking(originalContrtact, owner);
        const ownableMessage = 'Ownable: caller is not the owner';
        await expect(
            contract.connect(validator1).withdrawAllMadCQT(owner.address),
        ).to.be.revertedWith(ownableMessage);
        await expect(
            contract.connect(validator1).setCQTAddress(owner.address),
        ).to.be.revertedWith(ownableMessage);
        await expect(
            contract.connect(validator1).burnDelegatorBalance(0, validator1.address),
        ).to.be.revertedWith(ownableMessage);

        await expect(
            contract.connect(validator2).burnDefaultDelegators(),
        ).to.be.revertedWith(ownableMessage);
        await expect(
            contract.connect(validator2).renounceOwnership(),
        ).to.be.revertedWith(ownableMessage);

    });

    it('Should revert when the given CQT address is zero', async function () {
        const [
            opManager,
            originalContrtact,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        const contract = await upgradeToMigrationStaking(originalContrtact, owner);
        await expect(
            contract.connect(opManager).setCQTAddress('0x0000000000000000000000000000000000000000'),
        ).to.be.revertedWith("Invalid CQT address");
    });

    it('Should revert when the given CQT address is zero', async function () {
        const [
            opManager,
            originalContrtact,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        const contract = await upgradeToMigrationStaking(originalContrtact, owner);
        await expect(
            contract.connect(opManager).withdrawAllMadCQT('0x0000000000000000000000000000000000000000'),
        ).to.be.revertedWith("Invalid recovery wallet address");
    });


    it('Should not burn self staked tokens.', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();

        const deposited = oneToken.mul(1000);
        await deposit(contract, deposited);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);

        const upgradedContract = await upgradeToMigrationStaking(contract, owner);


        let md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(10000));
        await upgradedContract.connect(owner).burnDelegatorBalance(0, validator1.address);
        md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(10000));

        md = await contract.getDelegatorMetadata(validator2.address, 1);
        expect(md.staked).to.equal(oneToken.mul(10000));
        await upgradedContract.connect(owner).burnDelegatorBalance(1, validator2.address);
        md = await contract.getDelegatorMetadata(validator2.address, 1);
        expect(md.staked).to.equal(oneToken.mul(10000));

        md = await contract.getDelegatorMetadata(delegator1.address, 2);
        expect(md.staked).to.equal(oneToken.mul(10000));
        await upgradedContract.connect(owner).burnDelegatorBalance(2, delegator1.address);
        md = await contract.getDelegatorMetadata(delegator1.address, 2);
        expect(md.staked).to.equal(oneToken.mul(10000));

        md = await contract.getDelegatorMetadata(delegator2.address, 3);
        expect(md.staked).to.equal(oneToken.mul(10000));
        await upgradedContract.connect(owner).burnDelegatorBalance(3, delegator2.address);
        md = await contract.getDelegatorMetadata(delegator2.address, 3);
        expect(md.staked).to.equal(oneToken.mul(10000));
    });

    it('Should revert when providing invalid validator id.', async function () {
        const [
            opManager,
            originalContrtact,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();

        const contract = await upgradeToMigrationStaking(originalContrtact, owner);
        const message = 'Invalid validator';
        await expect(
            contract.connect(owner).burnDelegatorBalance(20, owner.address),
        ).to.be.revertedWith(message);
        await expect(
            contract.connect(owner).burnDelegatorBalance(10, owner.address),
        ).to.be.revertedWith(message);
        await expect(
            contract.connect(owner).burnDelegatorBalance(150, owner.address),
        ).to.be.revertedWith(message);
        await expect(
            contract.connect(owner).burnDelegatorBalance(120, owner.address),
        ).to.be.revertedWith(message);
    });

    it('Should return correct # of tokens staked', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        deposit(contract, oneToken.mul(1000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            oneToken.div(10),
        );
        await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
        let md = await contract.getValidatorCompoundedStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(100));

        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

        await contract.rewardValidators([0], [oneToken.mul(120)]);
        md = await contract.getValidatorCompoundedStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(381));

        const migrated = await upgradeToMigrationStaking(contract, opManager);
        md = await migrated.getValidatorCompoundedStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(381));

    });

    it('Should return correct # of tokens delegated', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        deposit(contract, oneToken.mul(1000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            oneToken.div(10),
        );
        await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
        let md = await contract.getValidatorCompoundedStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(100));

        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

        await contract.rewardValidators([0], [oneToken.mul(120)]);
        md = await contract.getValidatorCompoundedStakingData(0);
        expect(md.delegated).to.equal(oneToken.mul(127));

        const migrated = await upgradeToMigrationStaking(contract, opManager);
        md = await migrated.getValidatorCompoundedStakingData(0);
        expect(md.delegated).to.equal(oneToken.mul(127));

    });



    it('Should not change the owner if owner is renounced.', async function () {
        const [
            _opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        let opManager = await getOwner();
        let owner = await contract.connect(opManager).owner();
        await contract.connect(opManager).renounceOwnership();
        let owner2 = await contract.connect(opManager).owner();
        expect(owner).to.equal(owner2);

        await contract.connect(opManager).setMaxCapMultiplier(23);

        const migrated = await upgradeToMigrationStaking(contract, opManager);

        owner = await migrated.connect(opManager).owner();
        await migrated.connect(opManager).renounceOwnership();
        owner2 = await migrated.connect(opManager).owner();
        expect(owner).to.equal(owner2);
    });



    it('Should return correct # of tokens staked by validator', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        // deposit(contract, oneToken.mul(100000))
        await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
        await stake(oneToken, validator1, cqtContract, contract, 0);
        let md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.staked).to.equal(oneToken);

        await stake(oneToken, validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);
        md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(202));

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getDelegatorMetadata(validator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(202));
    });

    it('Should return correct # of tokens staked by delegator', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
        await stake(oneToken, validator1, cqtContract, contract, 0);

        await stake(oneToken, validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);
        md = await contract.getDelegatorMetadata(delegator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(100));

        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(400), delegator1, cqtContract, contract, 0);
        md = await contract.getDelegatorMetadata(delegator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(500));

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getDelegatorMetadata(delegator1.address, 0);
        expect(md.staked).to.equal(oneToken.mul(500));
    });

    it('Should return correct amounts of unstakings', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        const required = oneToken.mul(10000);
        await deposit(contract, oneToken.mul(2000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            1000000000000,
        );
        await stake(required, validator1, cqtContract, contract, 0);
        await contract.connect(validator1).unstake(0, oneToken.mul(900));
        await contract.connect(validator1).unstake(0, oneToken.mul(9000));
        await contract.connect(validator1).unstake(0, oneToken.mul(90));
        md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.unstakingAmounts[0]).to.equal(oneToken.mul(900));
        expect(md.unstakingAmounts[1]).to.equal(oneToken.mul(9000));
        expect(md.unstakingAmounts[2]).to.equal(oneToken.mul(90));

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getDelegatorMetadata(validator1.address, 0);
        expect(md.unstakingAmounts[0]).to.equal(oneToken.mul(900));
        expect(md.unstakingAmounts[1]).to.equal(oneToken.mul(9000));
        expect(md.unstakingAmounts[2]).to.equal(oneToken.mul(90));
    });

    it('Should return correct end epochs of unstakings', async function () {
        const [
            owner,
            _contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const contract = await deployStaking([
            CQT_ETH_MAINNET,
            10,
            20,
            5,
            oneToken.mul(100000)
        ]);
        await contract.connect(owner).setStakingManagerAddress(owner.address);

        const required = oneToken.mul(10000);
        await contract.setMaxCapMultiplier(20);
        await deposit(contract, oneToken.mul(2000));
        await addEnabledValidator(
            0,
            contract,
            owner,
            VALIDATOR_1,
            1000000000000,
        );
        await stake(required, validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(1000), delegator1, cqtContract, contract, 0);
        const r1 = await contract.connect(validator1).unstake(0, oneToken.mul(900));
        const r2 = await contract
            .connect(validator1)
            .unstake(0, oneToken.mul(9000));
        const r3 = await contract.connect(delegator1).unstake(0, oneToken.mul(90));
        md = await contract.getDelegatorMetadata(validator1.address, 0);
        expect(md.unstakingsEndEpochs[0]).to.equal(r1.blockNumber + 20);
        expect(md.unstakingsEndEpochs[1]).to.equal(r2.blockNumber + 20);

        md = await contract.getDelegatorMetadata(delegator1.address, 0);
        expect(md.unstakingsEndEpochs[0]).to.equal(r3.blockNumber + 10);

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getDelegatorMetadata(validator1.address, 0);
        expect(md.unstakingsEndEpochs[0]).to.equal(r1.blockNumber + 20);
        expect(md.unstakingsEndEpochs[1]).to.equal(r2.blockNumber + 20);

        md = await migrated.getDelegatorMetadata(delegator1.address, 0);
        expect(md.unstakingsEndEpochs[0]).to.equal(r3.blockNumber + 10);

    });


    it('Should revert when validator id is invalid', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        await addEnabledValidator(0, contract, opManager, VALIDATOR_1, 100);
        await expect(contract.getDelegatorMetadata(delegator1.address, 1)).to.revertedWith("Invalid validator");
        await expect(contract.getDelegatorMetadata(delegator1.address, 10)).to.revertedWith("Invalid validator");

        const migrated = await upgradeToMigrationStaking(contract, owner);
        await expect(migrated.getDelegatorMetadata(delegator1.address, 1)).to.revertedWith("Invalid validator");
        await expect(migrated.getDelegatorMetadata(delegator1.address, 10)).to.revertedWith("Invalid validator");
    });


    it('Should return correct # of tokens staked', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        deposit(contract, oneToken.mul(1000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            oneToken.div(10),
        );
        await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
        let md = await contract.getValidatorStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(100));

        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

        await contract.rewardValidators([0], [oneToken.mul(120)]);
        md = await contract.getValidatorStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(300));

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getValidatorStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(300));
    });

    it('Should return correct # of tokens delegated', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        deposit(contract, oneToken.mul(1000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            oneToken.div(10),
        );
        await stake(oneToken.mul(100), validator1, cqtContract, contract, 0);
        let md = await contract.getValidatorStakingData(0);
        expect(md.staked).to.equal(oneToken.mul(100));

        await stake(oneToken.mul(200), validator1, cqtContract, contract, 0);
        await stake(oneToken.mul(100), delegator1, cqtContract, contract, 0);

        await contract.rewardValidators([0], [oneToken.mul(120)]);
        md = await contract.getValidatorStakingData(0);
        expect(md.delegated).to.equal(oneToken.mul(100));

        const migrated = await upgradeToMigrationStaking(contract, owner);
        md = await migrated.getValidatorStakingData(0);
        expect(md.delegated).to.equal(oneToken.mul(100));
    });

    it('Should revert when validator id is invalid', async function () {
        const [
            opManager,
            contract,
            cqtContract,
            validator1,
            validator2,
            delegator1,
            delegator2,
        ] = await getAll();
        const owner = await getOwner();
        deposit(contract, oneToken.mul(1000));
        await addEnabledValidator(
            0,
            contract,
            opManager,
            VALIDATOR_1,
            oneToken.div(10),
        );
        await expect(contract.getValidatorStakingData(2)).to.revertedWith("Invalid validator");
        const migrated = await upgradeToMigrationStaking(contract, owner);
        await expect(migrated.getValidatorStakingData(2)).to.revertedWith("Invalid validator");
    });
});

