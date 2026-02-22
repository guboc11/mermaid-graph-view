import { useState, useMemo } from 'react';
import Editor from './components/Editor';
import GraphView from './components/GraphView';
import { parseMermaidClassDiagram } from './utils/parseMermaid';
import './App.css';

const DEFAULT_DIAGRAM = `classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +String breed
        +bark()
        +fetch()
    }
    class Cat {
        +String color
        +boolean indoor
        +meow()
    }
    class Vehicle {
        +String make
        +String model
        +int year
        +drive()
    }
    class Engine {
        +int horsepower
        +String fuelType
        +start()
    }
    class ElectricCar {
        +int batteryCapacity
        +charge()
    }
    class Driver {
        +String name
        +String license
        +drive()
    }

    Animal <|-- Dog : extends
    Animal <|-- Cat : extends
    Vehicle *-- Engine : has
    Vehicle <|-- ElectricCar : extends
    Driver --> Vehicle : drives
    Dog --> Cat : chases
`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_DIAGRAM);
  const [graphKey, setGraphKey] = useState(0);

  const { nodes, links } = useMemo(
    () => parseMermaidClassDiagram(code),
    [code]
  );

  const handleReset = () => {
    localStorage.removeItem('mgv-layout');
    setGraphKey((k) => k + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-logo">◈</span>
          <span>Mermaid Graph Viewer</span>
        </div>
        <div className="app-meta">
          <span className="app-stats">
            {nodes.length} nodes · {links.length} edges
          </span>
          <button className="reset-btn" onClick={handleReset} title="레이아웃 초기화">
            ↺ Reset
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="editor-panel">
          <div className="panel-header">classDiagram</div>
          <Editor value={code} onChange={setCode} />
        </div>

        <div className="graph-panel">
          <GraphView nodes={nodes} links={links} graphKey={graphKey} />
        </div>
      </main>
    </div>
  );
}
