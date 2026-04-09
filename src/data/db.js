// Data Access Layer — localStorage abstraction

const STORAGE_PREFIX = 'cp_';

export const db = {
  get(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  set(key, data) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  },

  getOne(key) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setOne(key, data) {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  },

  // CRUD helpers
  getAll(collection) {
    return this.get(collection);
  },

  getById(collection, id) {
    const items = this.get(collection);
    return items.find(item => item.id === id) || null;
  },

  create(collection, item) {
    const items = this.get(collection);
    const newItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      order: items.length > 0 ? Math.max(...items.map(t => t.order || 0)) + 1 : 0
    };
    items.push(newItem);
    this.set(collection, items);
    return newItem;
  },

  update(collection, id, updates) {
    const items = this.get(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...updates };
    this.set(collection, items);
    return items[index];
  },

  updateBatch(collection, updatesArray) {
    const items = this.get(collection);
    let changed = false;
    
    for (const update of updatesArray) {
      const index = items.findIndex(item => item.id === update.id);
      if (index !== -1) {
        items[index] = { ...items[index], ...update.updates };
        changed = true;
      }
    }
    
    if (changed) {
      this.set(collection, items);
    }
    return changed;
  },

  remove(collection, id) {
    const items = this.get(collection);
    const filtered = items.filter(item => item.id !== id);
    this.set(collection, filtered);
  },

  clearCollection(collection) {
    localStorage.removeItem(STORAGE_PREFIX + collection);
  },

  clearAll() {
    const keys = Object.keys(localStorage).filter(k => 
      k.startsWith(STORAGE_PREFIX) && 
      !k.includes('initialized') && 
      !k.includes('mode') && 
      !k.includes('accent')
    );
    keys.forEach(k => localStorage.removeItem(k));
  },

  isInitialized() {
    return localStorage.getItem(STORAGE_PREFIX + 'initialized') === 'true';
  },

  setInitialized() {
    localStorage.setItem(STORAGE_PREFIX + 'initialized', 'true');
  },

  hasData() {
    return Object.keys(localStorage).some(k => 
      k.startsWith(STORAGE_PREFIX) && 
      !k.includes('_demo_loaded') && 
      !k.includes('theme')
    );
  },

  isDemoLoaded() {
    return localStorage.getItem(STORAGE_PREFIX + '_demo_loaded') === 'true';
  },

  setDemoLoaded() {
    localStorage.setItem(STORAGE_PREFIX + '_demo_loaded', 'true');
  },

  clearDemoFlag() {
    localStorage.removeItem(STORAGE_PREFIX + '_demo_loaded');
  }
};

// Collections
export const COLLECTIONS = {
  TASKS: 'tasks',
  FINANCE: 'finance',
  LEARNINGS: 'learnings',
  EXPERIMENTS: 'experiments',
  WEEKLY_REVIEWS: 'weekly_reviews',
  DAILY_CHECKINS: 'daily_checkins',
  TIME_ALLOCATIONS: 'time_allocations',
  WORKOUT_ROUTINES: 'workout_routines',
  WORKOUT_LOGS: 'workout_logs',
};
