const {ethers} = require('hardhat');
const zero = () => ethers.BigNumber.from(0);

class RewardsCalculator {
  delegations;
  divider;
  totalStaked;
  validators;
  commissions;

  constructor(divider) {
    this.divider = divider;
    this.validators = {};
    this.delegations = {};
  }

  addValidator(id, rate, address) {
    id = id.toString();
    if (!(id in this.validators)) {
      this.validators[id] = {};
      this.validators[id].totalStaked = zero();
      this.validators[id].availableRewardsCommission = zero();
      this.validators[id].rate = rate;
      this.validators[id].address = address;
    }
  }
  isValidator(id, address) {
    id = id.toString();
    return this.validators[id].address == address;
  }

  initializeDelegatorInstance(id) {
    id = id.toString();
    this.delegations[id] = {};
  }
  initializeDelegatorValidatorInstance(address, id) {
    id = id.toString();
    this.delegations[id][address] = {};
    this.delegations[id][address].staked = zero();
    this.delegations[id][address].availableRewards = zero();
  }

  stake(amount, address, id) {
    id = id.toString();
    if (id in this.delegations) {
      if (!(address in this.delegations[id])) {
        this.initializeDelegatorValidatorInstance(address, id);
      }
    } else {
      this.initializeDelegatorInstance(id);
      this.initializeDelegatorValidatorInstance(address, id);
    }
    this.validators[id].totalStaked =
      this.validators[id].totalStaked.add(amount);
    this.delegations[id][address].staked =
      this.delegations[id][address].staked.add(amount);
  }

  getRewards(address, id) {
    id = id.toString();

    const rewards = [this.delegations[id][address].availableRewards, zero()];
    if (address == this.validators[id].address) {
      rewards[1] = this.validators[id].availableRewardsCommission;
    }
    return rewards;
  }

  getCommissionRewards(id) {
    id = id.toString();
    return this.validators[id].availableRewardsCommission;
  }
  redeemAllRewards(address, id) {
    id = id.toString();
    this.validators[id].totalStaked = this.validators[id].totalStaked.sub(
        this.delegations[id][address].availableRewards,
    );
    this.delegations[id][address].availableRewards = zero();
    if (address == this.validators[id].address) {
      // comission is not compounded
      this.validators[id].availableRewardsCommission = zero();
    }
  }

  redeemCommission(amount, id) {
    id = id.toString();
    amount = ethers.BigNumber.from(amount);
    this.validators[id].availableRewardsCommission = this.validators[id].availableRewardsCommission.sub(amount);
  }

  redeemAllCommission(id) {
    id = id.toString();
    this.validators[id].availableRewardsCommission = zero()
  }

  redeemRewards(amount, address, id) {
    id = id.toString();
    amount = ethers.BigNumber.from(amount);
    this.delegations[id][address].availableRewards =
    this.delegations[id][address].availableRewards.sub(amount);
    this.validators[id].totalStaked =
    this.validators[id].totalStaked.sub(amount);
  }

  unstake(amount, address, id) {
    id = id.toString();

    if (!this.validators[id].disabled) {
      if (amount.lte(this.delegations[id][address].staked)) {
        this.delegations[id][address].staked =
          this.delegations[id][address].staked.sub(amount);
        this.validators[id].totalStaked =
          this.validators[id].totalStaked.sub(amount);
      } else {
        throw 'Bad unstake input';
      }
    }
  }

  rewardValidator(id, amount) {
    id = id.toString();
    const v = this.validators[id];
    const commission = amount.mul(v.rate).div(this.divider);
    amount = amount.sub(commission);
    this.validators[id].availableRewardsCommission =
      v.availableRewardsCommission.add(commission);
    for (const [address, o] of Object.entries(this.delegations[id])) {
      const ratio = o.availableRewards
          .add(o.staked)
          .mul(this.divider)
          .div(v.totalStaked);
      this.delegations[id][address].availableRewards = o.availableRewards.add(
          amount.mul(ratio).div(this.divider),
      );
    }
    this.validators[id].totalStaked = v.totalStaked.add(amount);
  }
}

exports.RewardsCalculator = RewardsCalculator;
