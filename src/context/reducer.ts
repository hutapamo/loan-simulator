import type { AppState, AppAction, SavedScenario } from '../types/index';
import { saveStateToStorage } from './defaults';

/**
 * Application state reducer
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  let newState: AppState;

  switch (action.type) {
    case 'UPDATE_LOAN_STATE':
      newState = {
        ...state,
        loan_state: {
          ...state.loan_state,
          ...action.payload,
        },
      };
      break;

    case 'UPDATE_INTEREST_RULES':
      newState = {
        ...state,
        interest_rules: {
          ...state.interest_rules,
          ...action.payload,
        },
      };
      break;

    case 'UPDATE_PAYMENT_RULES':
      newState = {
        ...state,
        payment_rules: {
          ...state.payment_rules,
          ...action.payload,
        },
      };
      break;

    case 'UPDATE_SCENARIO_CONTROLS':
      newState = {
        ...state,
        scenario_controls: {
          ...state.scenario_controls,
          ...action.payload,
        },
      };
      break;

    case 'UPDATE_EXTRA_MONTHLY':
      newState = {
        ...state,
        scenario_controls: {
          ...state.scenario_controls,
          extra_monthly: {
            ...state.scenario_controls.extra_monthly,
            ...action.payload,
          },
        },
      };
      break;

    case 'ADD_LUMP_SUM':
      newState = {
        ...state,
        scenario_controls: {
          ...state.scenario_controls,
          lump_sums: [...state.scenario_controls.lump_sums, action.payload],
        },
      };
      break;

    case 'UPDATE_LUMP_SUM':
      newState = {
        ...state,
        scenario_controls: {
          ...state.scenario_controls,
          lump_sums: state.scenario_controls.lump_sums.map(ls =>
            ls.id === action.payload.id ? { ...ls, ...action.payload.data } : ls
          ),
        },
      };
      break;

    case 'DELETE_LUMP_SUM':
      newState = {
        ...state,
        scenario_controls: {
          ...state.scenario_controls,
          lump_sums: state.scenario_controls.lump_sums.filter(ls => ls.id !== action.payload),
        },
      };
      break;

    case 'SAVE_SCENARIO': {
      const now = new Date().toISOString();
      const scenario: SavedScenario = {
        id: `scenario-${Date.now()}`,
        name: action.payload.name,
        created_at: now,
        updated_at: now,
        loan_state: state.loan_state,
        interest_rules: state.interest_rules,
        payment_rules: state.payment_rules,
        scenario_controls: state.scenario_controls,
      };

      newState = {
        ...state,
        saved_scenarios: [...state.saved_scenarios, scenario],
        current_scenario_id: scenario.id,
      };
      break;
    }

    case 'LOAD_SCENARIO': {
      const scenario = state.saved_scenarios.find(s => s.id === action.payload);
      if (!scenario) return state;

      newState = {
        ...state,
        loan_state: scenario.loan_state,
        interest_rules: scenario.interest_rules,
        payment_rules: scenario.payment_rules,
        scenario_controls: scenario.scenario_controls,
        current_scenario_id: scenario.id,
      };
      break;
    }

    case 'DELETE_SCENARIO':
      newState = {
        ...state,
        saved_scenarios: state.saved_scenarios.filter(s => s.id !== action.payload),
        current_scenario_id: state.current_scenario_id === action.payload 
          ? undefined 
          : state.current_scenario_id,
      };
      break;

    case 'UPDATE_VERIFICATION_INPUT':
      newState = {
        ...state,
        verification_input: action.payload,
      };
      break;

    case 'LOAD_FROM_STORAGE':
      return action.payload;

    case 'RESET_TO_DEFAULTS':
      newState = {
        ...state,
        saved_scenarios: state.saved_scenarios, // Keep saved scenarios
      };
      break;

    default:
      return state;
  }

  // Auto-save to localStorage
  saveStateToStorage(newState);
  return newState;
}
