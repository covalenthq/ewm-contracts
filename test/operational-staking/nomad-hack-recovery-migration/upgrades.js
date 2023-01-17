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
    "0xa312F7156A2F4290D53e5694afE44e9cC7f1B811",
    "0x1DB596c09f5B37013B3cc263B9903D2474050F3f"
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

async function getMadCQTBurntAmount(txResult) {
    const receipt = await txResult.wait();
    const events = receipt.events.filter((x) => {
        return x.event == "MadCQTBurnt";
    });

    let sum = 0;
    for (let index = 0; index < events.length; index++) {
        const event = events[index];
        const amount = event.args.amount;
        sum = amount.add(sum);
    }
    return sum;
}

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

    it('Should emit MadCQTWithdrawn CQT address in between', async function () {
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
        let res = await migrationStaking.withdrawAllMadCQT(owner.address);

        expect(res)
            .to.emit(contract, 'MadCQTWithdrawn')
            .withArgs(CQT_ETH_MAINNET, (oneToken.mul(1000)).add(oneToken.mul(10000)));

        let res2 = await migrationStaking.withdrawAllMadCQT(owner.address);

        expect(res2)
            .to.emit(contract, 'MadCQTWithdrawn')
            .withArgs(CQT_ETH_MAINNET, 0);
    });



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
        await migrationStaking.withdrawAllMadCQT(owner.address);
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

        let delegators = [];
        for (let index = 0; index < defaultAccountsToBurn.length; index++) {
            const d = await getSigner(defaultAccountsToBurn[index]);
            delegators.push(d);

        }

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);
        const selfStakedPerValidator = oneToken.mul(10000);
        const selfStakedTotal = oneToken.mul(10000).mul(5);

        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegators[4], 4);

        const unscaledStakesD0 = [100, 10, 20, 90, 1];
        const unscaledStakesD1 = [20, 200, 5, 80, 2];
        const unscaledStakesD2 = [5, 11, 10, 5, 3];
        const unscaledStakesD3 = [1, 14, 12, 2, 4];
        const unscaledStakesD4 = [17, 16, 120, 2, 70];
        const unscaledStakesD5 = [120, 15, 2, 9, 7];

        const delegatorStaked = [unscaledStakesD0, unscaledStakesD1, unscaledStakesD2, unscaledStakesD3, unscaledStakesD4, unscaledStakesD5];

        const validatorIds = [0, 1, 2, 3, 4];

        let totalSum = 0;
        for (let index = 0; index < delegators.length; index++) {
            const d = delegators[index];
            const staked = delegatorStaked[index];
            await stakeToValidators(validatorIds, staked, contract, d, cqtContract);
            let r = await getDelegatorBalances(contract, d.address);
            let sum = getScaledAmountsSum(staked);
            if (index == 4) {
                expect(r.sum).to.equal(sum.add(selfStakedPerValidator));
            }
            else {
                expect(r.sum).to.equal(sum);
            }

            totalSum = sum.add(totalSum);
        }

        const expectedBalance = totalSum.add(deposited).add(selfStakedTotal);
        expect(await cqtContract.balanceOf(contract.address)).to.equal(expectedBalance.toString());

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);
        let res = await migrationStaking.connect(owner).burnDefaultDelegators();
        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);

        for (let index = 0; index < delegators.length; index++) {
            const d = delegators[index];
            let sum = getScaledAmountsSum(delegatorStaked[index]);
            expect(res)
                .to.emit(contract, 'MadCQTBurnt')
                .withArgs(sum);
            let r = await getDelegatorBalances(newOriginalStaking, d.address);
            if (index == 4) {
                expect(r.sum).to.equal(oneToken.mul(10070));
            }
            else {
                expect(r.sum).to.equal(0);
            }
        }
    }
    );


    it('Old balance minus sum of amounts in MadCQTBurnt events should match the total staked and delegated', async function () {
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

        let delegators = [];
        for (let index = 0; index < defaultAccountsToBurn.length; index++) {
            const d = await getSigner(defaultAccountsToBurn[index]);
            delegators.push(d);

        }

        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator1, 0);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, validator2, 1);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator1, 2);
        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegator2, 3);
        const selfStakedPerValidator = oneToken.mul(10000);
        const selfStakedTotal = oneToken.mul(10000).mul(5);

        await expect((await contract.getMetadata()).CQTaddress).to.equal(CQT_ETH_MAINNET);

        await addValidatorAndSelfStake(contract, cqtContract, opManager, delegators[4], 4);

        const unscaledStakesD0 = [100, 10, 20, 90, 1];
        const unscaledStakesD1 = [20, 200, 5, 80, 2];
        const unscaledStakesD2 = [5, 11, 10, 5, 3];
        const unscaledStakesD3 = [1, 14, 12, 2, 4];
        const unscaledStakesD4 = [17, 16, 120, 2, 70];
        const unscaledStakesD5 = [120, 15, 2, 9, 7];

        const delegatorStaked = [unscaledStakesD0, unscaledStakesD1, unscaledStakesD2, unscaledStakesD3, unscaledStakesD4, unscaledStakesD5];

        const validatorIds = [0, 1, 2, 3, 4];

        let totalSum = 0;
        for (let index = 0; index < delegators.length; index++) {
            const d = delegators[index];
            const staked = delegatorStaked[index];
            await stakeToValidators(validatorIds, staked, contract, d, cqtContract);
            let r = await getDelegatorBalances(contract, d.address);
            let sum = getScaledAmountsSum(staked);
            if (index == 4) {
                expect(r.sum).to.equal(sum.add(selfStakedPerValidator));
            }
            else {
                expect(r.sum).to.equal(sum);
            }

            totalSum = sum.add(totalSum);
        }

        const expectedBalance = totalSum.add(deposited).add(selfStakedTotal);
        const currentBalance = await cqtContract.balanceOf(contract.address);
        expect(currentBalance).to.equal(expectedBalance.toString());

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);
        let res = await migrationStaking.connect(owner).burnDefaultDelegators();
        let allBurnt = await getMadCQTBurntAmount(res);


        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);


        for (let index = 0; index < delegators.length; index++) {
            const d = delegators[index];
            let sum = getScaledAmountsSum(delegatorStaked[index]);
            expect(res)
                .to.emit(contract, 'MadCQTBurnt')
                .withArgs(sum);

            let r = await getDelegatorBalances(newOriginalStaking, d.address);
            if (index == 4) {
                expect(r.sum).to.equal(oneToken.mul(10070));
            }
            else {
                expect(r.sum).to.equal(0);
            }
        }

        let newTotalSum = 0;

        let nonDelegatingValidators = [validator1, validator2, delegator1, delegator2];
        const all = delegators.concat(nonDelegatingValidators);
        for (let index = 0; index < all.length; index++) {
            const v = all[index];
            let s = await getDelegatorBalances(newOriginalStaking, v.address);
            newTotalSum = s.sum.add(newTotalSum);
        }

        let depositedNew = (await contract.getMetadata())._rewardPool;
        newTotalSum = newTotalSum.add(depositedNew);
        let newExpectedVirtualBalance = currentBalance.sub(allBurnt);

        expect(newExpectedVirtualBalance).to.equal(newTotalSum);
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

        const ds = [d1, d2, d3, d4];

        const unscaledStakesD1 = [100, 10, 20];
        const unscaledStakesD2 = [20, 200, 5];
        const unscaledStakesD3 = [5, 11, 10];
        const unscaledStakesD4 = [1, 14, 12];

        const delegatorStakes = [unscaledStakesD1, unscaledStakesD2, unscaledStakesD3, unscaledStakesD4];

        const validatorIds = [0, 1, 2, 3];

        let totalSum = 0;
        let sums = [];
        for (let index = 0; index < ds.length; index++) {
            const d = ds[index];
            const staked = delegatorStakes[index];
            await stakeToValidators(validatorIds, staked, contract, d, cqtContract);

            let r = await getDelegatorBalances(contract, d.address);
            let sum = getScaledAmountsSum(staked);
            expect(r.sum).to.equal(sum);

            totalSum = sum.add(totalSum);
            sums.push(sum);
        }

        const expectedBalance = totalSum.add(deposited).add(selfStaked);
        expect(await cqtContract.balanceOf(contract.address)).to.equal(expectedBalance.toString());

        const migrationStaking = await upgradeToMigrationStaking(contract, owner);

        let ids = [0, 1, 2, 2];
        for (let index = 0; index < ds.length; index++) {
            const d = ds[index];
            const id = ids[index];
            let res = await migrationStaking.connect(owner).burnDelegatorBalance(id, d.address);

            const burntStake = oneToken.mul(delegatorStakes[index][id]);
            expect(res)
                .to.emit(contract, 'MadCQTBurnt')
                .withArgs(burntStake);
        }

        const newOriginalStaking = await upgradeToOriginalStaking(migrationStaking, owner);

        for (let index = 0; index < ds.length; index++) {
            const d = ds[index];
            const id = ids[index];
            const burntStake = oneToken.mul(delegatorStakes[index][id]);
            r = await getDelegatorBalances(newOriginalStaking, d.address);
            expect(r.sum).to.equal(sums[index].sub(burntStake));
        }
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

    it('Should revert when the given CQT address is the same as before', async function () {
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
        const addr = (await contract.getMetadata()).CQTaddress;
        await expect(
            contract.connect(opManager).setCQTAddress(addr),
        ).to.be.revertedWith("New CQT address cannot be equal to the old one");
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

