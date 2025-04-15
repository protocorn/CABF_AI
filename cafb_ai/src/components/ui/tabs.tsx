'use client';

import * as React from 'react';

type TabsContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const TabsContext = React.createContext<TabsContextType | null>(null);

// Main Tabs container
export function Tabs({ children, defaultValue }: { children: React.ReactNode; defaultValue: string }) {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

// Tab list (horizontal row)
export function TabsList({ children }: { children: React.ReactNode }) {
  return <div className="flex border-b mb-2">{children}</div>;
}

// Individual tab trigger button
export function TabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 font-medium rounded-t ${
        isActive ? 'bg-white border-t border-l border-r text-blue-600' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// Content for a tab
export function TabsContent({ value, children }: { value: string; children: React.ReactNode }) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  const { activeTab } = context;

  return activeTab === value ? <div className="p-4 bg-white border rounded-b">{children}</div> : null;
}
