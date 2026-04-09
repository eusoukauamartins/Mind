// App Context — global state management
import { createContext, useContext, useReducer, useCallback } from 'react';
import { db, COLLECTIONS } from '../data/db';

const AppContext = createContext(null);

const initialState = {
  tasks: [],
  finance: [],
  learnings: [],
  experiments: [],
  weeklyReviews: [],
  dailyCheckIns: [],
  timeAllocations: [],
  workoutRoutines: [],
  workoutLogs: [],
  lastUpdate: Date.now(),
};

function reducer(state, action) {
  switch (action.type) {
    case 'REFRESH_ALL':
      return {
        ...state,
        tasks: db.getAll(COLLECTIONS.TASKS),
        finance: db.getAll(COLLECTIONS.FINANCE),
        learnings: db.getAll(COLLECTIONS.LEARNINGS),
        experiments: db.getAll(COLLECTIONS.EXPERIMENTS),
        weeklyReviews: db.getAll(COLLECTIONS.WEEKLY_REVIEWS),
        dailyCheckIns: db.getAll(COLLECTIONS.DAILY_CHECKINS),
        timeAllocations: db.getAll(COLLECTIONS.TIME_ALLOCATIONS),
        workoutRoutines: db.getAll(COLLECTIONS.WORKOUT_ROUTINES),
        workoutLogs: db.getAll(COLLECTIONS.WORKOUT_LOGS),
        lastUpdate: Date.now(),
      };
    case 'REFRESH_COLLECTION':
      return {
        ...state,
        [action.collection]: db.getAll(action.dbKey),
        lastUpdate: Date.now(),
      };
    default:
      return state;
  }
}

const collectionMap = {
  tasks: COLLECTIONS.TASKS,
  finance: COLLECTIONS.FINANCE,
  learnings: COLLECTIONS.LEARNINGS,
  experiments: COLLECTIONS.EXPERIMENTS,
  weeklyReviews: COLLECTIONS.WEEKLY_REVIEWS,
  dailyCheckIns: COLLECTIONS.DAILY_CHECKINS,
  timeAllocations: COLLECTIONS.TIME_ALLOCATIONS,
  workoutRoutines: COLLECTIONS.WORKOUT_ROUTINES,
  workoutLogs: COLLECTIONS.WORKOUT_LOGS,
};

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshAll = useCallback(() => {
    dispatch({ type: 'REFRESH_ALL' });
  }, []);

  const refreshCollection = useCallback((stateKey) => {
    dispatch({
      type: 'REFRESH_COLLECTION',
      collection: stateKey,
      dbKey: collectionMap[stateKey],
    });
  }, []);

  const createItem = useCallback((stateKey, item) => {
    const result = db.create(collectionMap[stateKey], item);
    refreshCollection(stateKey);
    return result;
  }, [refreshCollection]);

  const updateItem = useCallback((stateKey, id, updates) => {
    const result = db.update(collectionMap[stateKey], id, updates);
    refreshCollection(stateKey);
    return result;
  }, [refreshCollection]);

  const deleteItem = useCallback((stateKey, id) => {
    db.remove(collectionMap[stateKey], id);
    refreshCollection(stateKey);
  }, [refreshCollection]);

  const value = {
    ...state,
    refreshAll,
    refreshCollection,
    createItem,
    updateItem,
    deleteItem,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
