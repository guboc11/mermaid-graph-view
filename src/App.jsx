import { useState, useMemo } from 'react';
import Editor from './components/Editor';
import GraphView from './components/GraphView';
import { parseMermaidClassDiagram } from './utils/parseMermaid';
import './App.css';

const DEFAULT_DIAGRAM = `classDiagram
%% Learning Ontology: General-purpose RDBMS Knowledge Graph
%% Legend
%% Importance: <<Core>> / <<Major>> / <<Peripheral>>
%% Edge Strength: [S] Strong, [M] Medium, [W] Weak

class Database {
  <<Core>>
  +scope: system boundary
  +contains: schemas
  +purpose: persistent data platform
}
class Schema {
  <<Core>>
  +namespace: logical grouping
  +organizes: database objects
}
class Table {
  <<Core>>
  +structure: rows and columns
  +role: primary data container
}
class Row {
  <<Major>>
  +represents: one record
  +identified_by: key
}
class Column {
  <<Core>>
  +stores: attribute values
  +typed_by: DataType
}
class DataType {
  <<Major>>
  +defines: value domain
  +controls: storage and validation
}
class Constraint {
  <<Major>>
  +enforces: integrity rules
  +types: not-null/check/unique
}
class Index {
  <<Core>>
  +accelerates: data access
  +trades_off: write overhead
}
class View {
  <<Major>>
  +is: virtual table
  +encapsulates: query logic
}

class SQL {
  <<Core>>
  +language: declarative
  +covers: DDL DML DCL TCL
}
class Query {
  <<Core>>
  +expresses: data request
  +processed_by: optimizer
}
class ExecutionPlan {
  <<Major>>
  +describes: physical operators
  +driven_by: cost model
}
class Optimizer {
  <<Core>>
  +chooses: execution plan
  +uses: statistics
}
class Statistics {
  <<Major>>
  +captures: data distribution
  +improves: plan quality
}
class Join {
  <<Major>>
  +combines: multiple relations
  +types: nested/hash/merge
}
class Predicate {
  <<Major>>
  +filters: candidate rows
  +affects: selectivity
}

class Transaction {
  <<Core>>
  +unit: atomic work
  +boundaries: begin/commit/rollback
}
class ACID {
  <<Core>>
  +properties: atomicity consistency isolation durability
  +guarantees: reliability
}
class IsolationLevel {
  <<Major>>
  +controls: visibility anomalies
  +levels: RC RR Serializable
}
class Lock {
  <<Major>>
  +synchronizes: concurrent access
  +modes: shared/exclusive
}
class MVCC {
  <<Major>>
  +mechanism: versioned reads
  +reduces: read-write blocking
}
class Deadlock {
  <<Peripheral>>
  +cause: cyclic lock wait
  +handled_by: detection/timeout
}

class Entity {
  <<Major>>
  +models: real-world object
  +mapped_to: table
}
class Relationship {
  <<Major>>
  +models: association between entities
  +cardinality: one-to-many etc
}
class Normalization {
  <<Major>>
  +reduces: redundancy
  +improves: update consistency
}
class Denormalization {
  <<Peripheral>>
  +improves: read performance
  +cost: redundancy
}
class Key {
  <<Core>>
  +identifies: tuples
  +supports: relationships
}
class ReferentialIntegrity {
  <<Major>>
  +preserves: valid references
  +implemented_by: key constraints
}

class StorageEngine {
  <<Core>>
  +implements: physical storage
  +coordinates: IO and persistence
}
class Page {
  <<Major>>
  +unit: disk/memory block
  +contains: tuples/index entries
}
class BufferPool {
  <<Major>>
  +caches: pages in memory
  +optimizes: disk access
}
class WAL {
  <<Major>>
  +records: change log
  +enables: crash recovery
}
class Checkpoint {
  <<Peripheral>>
  +bounds: recovery window
  +flushes: dirty state
}

class Backup {
  <<Major>>
  +creates: restorable copy
  +modes: full/incremental
}
class Recovery {
  <<Core>>
  +restores: consistent state
  +uses: backup and logs
}
class Replication {
  <<Major>>
  +copies: data across nodes
  +supports: availability/read scale
}
class Partitioning {
  <<Major>>
  +splits: large tables
  +improves: manageability/pruning
}
class Sharding {
  <<Peripheral>>
  +distributes: data across databases
  +targets: horizontal scale
}
class HighAvailability {
  <<Major>>
  +goal: minimize downtime
  +combines: redundancy and failover
}
class Failover {
  <<Peripheral>>
  +switches: primary role
  +trigger: fault event
}

class User {
  <<Major>>
  +identity: principal
  +authenticates: connection
}
class Role {
  <<Major>>
  +groups: privileges
  +simplifies: access management
}
class Privilege {
  <<Major>>
  +grants: allowed action
  +scope: object or schema
}
class Audit {
  <<Peripheral>>
  +tracks: security events
  +supports: compliance
}
class Encryption {
  <<Peripheral>>
  +protects: data confidentiality
  +at: rest and transit
}

class OLTP {
  <<Major>>
  +workload: short transactions
  +focus: consistency/latency
}
class OLAP {
  <<Major>>
  +workload: analytical scans
  +focus: aggregation throughput
}
class MaterializedView {
  <<Peripheral>>
  +stores: precomputed results
  +benefit: faster analytics
}

Database --> Schema : [S] contains
Schema --> Table : [S] contains
Table --> Row : [S] stores
Table --> Column : [S] defines
Column --> DataType : [S] typed_as
Table --> Constraint : [M] constrained_by
Table --> Index : [S] indexed_by
View --> Query : [S] defined_by
Schema --> View : [M] contains

SQL --> Query : [S] expresses
Query --> Predicate : [S] filters_with
Query --> Join : [M] combines_with
Query --> Optimizer : [S] optimized_by
Optimizer --> Statistics : [S] depends_on
Optimizer --> ExecutionPlan : [S] produces
ExecutionPlan --> Index : [M] may_use
ExecutionPlan --> Join : [M] includes

Transaction --> ACID : [S] guarantees
Transaction --> IsolationLevel : [S] configured_by
Transaction --> Lock : [M] may_use
Transaction --> MVCC : [M] may_use
Lock --> Deadlock : [M] may_cause
IsolationLevel --> Deadlock : [W] influences_risk
WAL --> Transaction : [S] persists_changes_of
Checkpoint --> WAL : [M] truncates_dependency_on

Entity --> Table : [M] mapped_to
Relationship --> Entity : [S] links
Key --> Table : [S] identifies_rows_in
ReferentialIntegrity --> Key : [S] depends_on
Constraint --> ReferentialIntegrity : [M] enforces
Normalization --> Table : [M] structures
Denormalization --> Normalization : [W] trades_off
Denormalization --> Query : [M] optimizes_reads_for

StorageEngine --> Table : [S] stores
StorageEngine --> Page : [S] organizes_into
BufferPool --> Page : [S] caches
StorageEngine --> BufferPool : [M] uses
WAL --> Recovery : [S] enables
Backup --> Recovery : [S] enables
Recovery --> Database : [S] restores

Replication --> HighAvailability : [S] supports
Failover --> HighAvailability : [S] enables
Partitioning --> Table : [S] divides
Sharding --> Partitioning : [W] extends_distributedly
Sharding --> Database : [M] distributes
Replication --> Database : [M] copies

User --> Role : [M] assigned_to
Role --> Privilege : [S] aggregates
Privilege --> Table : [M] controls_access_to
Audit --> User : [M] records_actions_of
Encryption --> Database : [M] protects

OLTP --> Transaction : [S] relies_on
OLTP --> Index : [M] depends_on
OLAP --> Query : [S] relies_on
OLAP --> MaterializedView : [M] benefits_from
MaterializedView --> Query : [S] materializes
OLTP --> OLAP : [W] contrasted_with

class Database core
class Schema core
class Table core
class Column core
class Index core
class SQL core
class Query core
class Optimizer core
class Transaction core
class ACID core
class Key core
class StorageEngine core
class Recovery core

class Row major
class DataType major
class Constraint major
class View major
class ExecutionPlan major
class Statistics major
class Join major
class Predicate major
class IsolationLevel major
class Lock major
class MVCC major
class Entity major
class Relationship major
class Normalization major
class ReferentialIntegrity major
class Page major
class BufferPool major
class WAL major
class Backup major
class Replication major
class Partitioning major
class HighAvailability major
class User major
class Role major
class Privilege major
class OLTP major
class OLAP major

class Deadlock peripheral
class Denormalization peripheral
class Checkpoint peripheral
class Sharding peripheral
class Failover peripheral
class Audit peripheral
class Encryption peripheral
class MaterializedView peripheral

classDef core fill:#ffe08a,stroke:#6b4e00,stroke-width:2px,color:#202020
classDef major fill:#bde0fe,stroke:#1d4e89,stroke-width:1.5px,color:#102a43
classDef peripheral fill:#d9f2d9,stroke:#2f6b2f,stroke-width:1px,color:#1f3d1f
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
