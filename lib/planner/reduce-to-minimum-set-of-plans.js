'use strict';

const setOperations = require('../util/set-operations.js');

module.exports = function reduceToMinimumSetOfPlans(plans, callback) {
  let finalPlans = [];

  plans.forEach(function(plan, index) {
    let planPath = new Set(plan.path);
    let hasSuperset = false;

    let plansWithCurrentPlanRemoved = plans.filter(function(plan, filterIndex) {
      return index !== filterIndex;
    });

    for (let myPlan of plansWithCurrentPlanRemoved) {
      let myPlanPath = new Set(myPlan.path);
      if (setOperations.isSuperset(myPlanPath, planPath)) {
        hasSuperset = true;
        break;
      }
    }

    if (!hasSuperset) {
      finalPlans.push(plan);
    }
  });

  callback(null, finalPlans);
};
