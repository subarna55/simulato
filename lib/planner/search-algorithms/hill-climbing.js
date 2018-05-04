'use strict';

const Emitter = require('../../util/emitter.js');
const setOperations = require('../set-operations.js');
const _ = require('lodash');

let hillClimbing;
module.exports = hillClimbing = {
    * createPlans(existingPlans, discoveredActions) {
        let next = yield;

        let plans = [];
        let satisfiedActions = new Set();
        let actionCounts = yield hillClimbing.emit('hillClimbing.calculateActionCounts', existingPlans, discoveredActions, next);
        let components = yield hillClimbing.emit('hillClimbing.getComponents', next);

        let entryComponents = [];
        for (let type in components) {
            if (components[type].entryComponent) {
                entryComponents.push(type);
            }
        }

        let maxPlanLength = 200;
        while (satisfiedActions.size < actionCounts.size) {
            let savedPlans = [];
            let plan = yield hillClimbing.emit('hillClimbing.createSearchNode', new Set(), next);
            let component = components[entryComponents[0]];
            plan.path = [];
            plan.state.createAndAddComponent({
                type: entryComponents[0],
                name: component.entryComponent.name,
                state: component.entryComponent.state,
                options: component.entryComponent.options,
            });

            plan.testCase.push({
                type: entryComponents[0],
                name: component.entryComponent.name,
                state: component.entryComponent.state,
                options: component.entryComponent.options,
            });
            plan.actions = yield hillClimbing.emit('hillClimbing.getPossibleActions', plan, next);
            while (plan.path.length < maxPlanLength && satisfiedActions.size < actionCounts.size) {
                if (plan.actions.has(plan.lastAction)) {
                    plan.actions.delete(plan.lastAction);
                }
                if (plan.actions.size === 0) {
                    if (plan.path.length > 0) {
                        break;
                    } else {
                        throw new Error('No possible actions in starting state');
                    }
                }
                let action = yield hillClimbing.emitAsync('hillClimbing.chooseAction', plan, actionCounts, satisfiedActions, next);
                if (action === null) {
                    if (plan.path.length > 0) {
                        break;
                    } else {
                        throw new Error('No possible actions in starting state');
                    }
                }
                plan.path.push(action);
                yield hillClimbing.emitAsync('hillClimbing.applyEffects', plan, next);
                plan.actions = yield hillClimbing.emit('hillClimbing.getPossibleActions', plan, next);

                satisfiedActions.add(action);
                let prunedPlans = yield hillClimbing.emitAsync('hillClimbing.pruneExistingPlans', existingPlans, satisfiedActions, next);
                if (prunedPlans.length !== existingPlans.length) {
                    existingPlans = prunedPlans;
                    actionCounts = yield hillClimbing.emit('hillClimbing.calculateActionCounts', existingPlans, discoveredActions, next);
                }
                let loopStartIndex = yield hillClimbing.emitAsync('hillClimbing.detectLoop', plan, next);
                if (loopStartIndex !== -1) {
                    let {backtrackPlan, newSavedPlans} = yield hillClimbing.emitAsync('hillClimbing.backtrack', plan, savedPlans, loopStartIndex, next);
                    if (backtrackPlan !== null) {
                        plan = backtrackPlan;
                        savedPlans = newSavedPlans;
                        console.log('I have backtracked');
                    } else {
                        console.log('I have not been able to backtracked');
                    }
                } else {
                    let copyOfPlan = yield hillClimbing.emitAsync('hillClimbing.cloneSearchNode', plan, next);
                    savedPlans.push(copyOfPlan);
                }
            }
            let duplicate = yield hillClimbing.emitAsync('hillClimbing.isDuplicate', plans, plan, next);
            if (duplicate) {
                throw new Error('Generated a duplicate plan!');
            }
            plans.push(plan);
        }

        hillClimbing.emitAsync('hillClimbing.planningFinished', plans, discoveredActions);
    },
    pruneExistingPlans(existingPlans, satisfiedActions, callback) {
        let prunedPlans = [];
        for (let plan of existingPlans) {
            let superset = setOperations.isSuperset(satisfiedActions, new Set(plan.path));
            if (!superset) {
                prunedPlans.push(plan);
            }
        }

        callback(null, prunedPlans);
    },
    isDuplicate(plans, plan, callback) {
        for (let aPlan of plans) {
            if (setOperations.isEqual(aPlan.path, new Set(plan.path))) {
                callback(null, true);
            }
        }
        callback(null, false);
    },
    * chooseAction(plan, actionCounts, satisfiedActions, callback) {
        let next = yield;

        let unusedActions = yield hillClimbing.emitAsync('hillClimbing.getUnusedActions', plan.actions, satisfiedActions, next);

        let actionWithSameComponent = yield hillClimbing.emitAsync('hillClimbing.getActionWithSameComponent', plan, unusedActions, next);
        if (actionWithSameComponent) {
            return callback(null, actionWithSameComponent);
        }
        if (unusedActions.length > 0) {
            return callback(null, unusedActions[0]);
        }

        let mostOccurringAction = yield hillClimbing.emitAsync('hillClimbing.getMostOccurringAction', plan.actions, actionCounts, next);
        if (mostOccurringAction) {
            return callback(null, mostOccurringAction);
        }

        return callback(null, null);
    },
    getActionWithSameComponent(plan, unusedActions, callback) {
        if (plan.lastAction) {
            let lastActionComponent = plan.lastAction.split('.')[0];
            for (let action of unusedActions) {
                let unusedActionComponent = action.split('.')[0];
                if (lastActionComponent === unusedActionComponent) {
                    return callback(null, action);
                }
            }
        }
        return callback(null, null);
    },
    getUnusedActions(possibleActions, satisfiedActions, callback) {
        let unusedActions = [];
        for (let action of possibleActions) {
            if (!satisfiedActions.has(action)) {
                unusedActions.push(action);
            }
        }

        return callback(null, unusedActions);
    },
    getMostOccurringAction(possibleActions, actionCounts, callback) {
        let mostOccurringAction = null;
        for (let action of possibleActions) {
            let mostOccurringActionCount = actionCounts.get(mostOccurringAction) || 0;
            let occurrences = actionCounts.get(action);
            if (mostOccurringActionCount < occurrences) {
                mostOccurringAction = action;
            }
        }
        callback(null, mostOccurringAction);
    },
    detectLoop(plan, callback) {
        let index = plan.path.indexOf(plan.lastAction);
        if (index === plan.path.length -1 || index === -1) {
            return callback(null, -1);
        } else {
            while (index !== -1 && index !== plan.path.length -1) {
                let potentiallyRepeatingSequence = plan.path.slice(index + 1, plan.path.length - 1);
                let earlierSequenceStartIndex = index - potentiallyRepeatingSequence.length;

                if (earlierSequenceStartIndex >= 0) {
                    let earlierSequence = plan.path.slice(index - potentiallyRepeatingSequence.length, index);
                    if (_.isEqual(earlierSequence, potentiallyRepeatingSequence)) {
                        return callback(null, index);
                    }
                }

                index = plan.path.indexOf(plan.lastAction, index + 1);
            }
        }
        return callback(null, -1);
    },
    * backtrack(plan, savedPlans, index, callback) {
        let next = yield;
        let backtrackPlanFound = false;
        let backtrackPlan = null;
        let newSavedPlans = null;

        while (index > 0 && !backtrackPlanFound) {
            backtrackPlan = yield hillClimbing.emitAsync('hillClimbing.cloneSearchNode', savedPlans[index], next);
            let actions = new Set(backtrackPlan.actions);

            actions.delete(savedPlans[index + 1].lastAction);

            if (actions.size > 0) {
                newSavedPlans = savedPlans.slice(0, index + 1);
                backtrackPlan.actions = actions;
                savedPlans[index].actions = actions;
                backtrackPlanFound = true;
            }

            index--;
        }

        callback(null, {backtrackPlan, newSavedPlans});
    },
};

Emitter.mixIn(hillClimbing);

hillClimbing.runOn('hillClimbing.createPlans', hillClimbing.createPlans);
hillClimbing.runOn('hillClimbing.chooseAction', hillClimbing.chooseAction);
hillClimbing.on('hillClimbing.getUnusedActions', hillClimbing.getUnusedActions);
hillClimbing.on('hillClimbing.pruneExistingPlans', hillClimbing.pruneExistingPlans);
hillClimbing.on('hillClimbing.isDuplicate', hillClimbing.isDuplicate);
hillClimbing.on('hillClimbing.getActionWithSameComponent', hillClimbing.getActionWithSameComponent);
hillClimbing.on('hillClimbing.getMostOccurringAction', hillClimbing.getMostOccurringAction);
hillClimbing.on('hillClimbing.detectLoop', hillClimbing.detectLoop);
hillClimbing.runOn('hillClimbing.backtrack', hillClimbing.backtrack);