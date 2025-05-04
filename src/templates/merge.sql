-- =====
-- Get tables from store databases
-- =====

attach database '{{ dbPath1 }}' as store1;

attach database '{{ dbPath2 }}' as store2;

create table if not exists store1.SchemaMigrations (
    migration text primary key not null
);

create table if not exists store2.SchemaMigrations (
    migration text primary key not null
);

drop table if exists SchemaMigrations1;

create table SchemaMigrations1 as
select *
from store1.SchemaMigrations;

drop table if exists SchemaMigrations2;

create table SchemaMigrations2 as
select *
from store2.SchemaMigrations;

drop table if exists ValidPaths1;

create table ValidPaths1 as
select *
from store1.ValidPaths;


drop table if exists ValidPaths2;

create table ValidPaths2 as
select *
from store2.ValidPaths;


drop table if exists Refs1;

create table Refs1 as
select *
from store1.Refs;


drop table if exists Refs2;

create table Refs2 as
select *
from store2.Refs;


drop table if exists DerivationOutputs1;

create table DerivationOutputs1 as
select *
from store1.DerivationOutputs;


drop table if exists DerivationOutputs2;

create table DerivationOutputs2 as
select *
from store2.DerivationOutputs;


-- =====
-- Copy realisations tables
-- =====

create table if not exists store1.Realisations (
    id integer primary key autoincrement not null,
    drvPath text not null,
    outputName text not null, -- symbolic output id, usually "out"
    outputPath integer not null,
    signatures text -- space-separated list
);


create table if not exists store2.Realisations (
    id integer primary key autoincrement not null,
    drvPath text not null,
    outputName text not null, -- symbolic output id, usually "out"
    outputPath integer not null,
    signatures text -- space-separated list
);


create table if not exists store1.RealisationsRefs (
    referrer integer not null,
    realisationReference integer
);


create table if not exists store2.RealisationsRefs (
    referrer integer not null,
    realisationReference integer
);



drop table if exists Realisations1;

create table Realisations1 as
select *
from store1.Realisations;


drop table if exists Realisations2;

create table Realisations2 as
select *
from store2.Realisations;


drop table if exists RealisationsRefs1;

create table RealisationsRefs1 as
select *
from store1.RealisationsRefs;


drop table if exists RealisationsRefs2;

create table RealisationsRefs2 as
select *
from store2.RealisationsRefs;


detach database store1;

detach database store2;

-- =====
-- Create a table for combined SchemaMigrations
-- =====

drop table if exists SchemaMigrations;

create table SchemaMigrations (
    migration text primary key not null
);

-- =====
-- Create a table for combined ValidPaths
-- =====

drop table if exists ValidPaths;

create table ValidPaths
(
    id               integer primary key autoincrement not null,
    path             text unique                       not null,
    hash             text                              not null, -- base16 representation
    registrationTime integer                           not null,
    deriver          text,
    narSize          integer,
    ultimate         integer,                                    -- null implies "false"
    sigs             text,                                       -- space-separated
    ca               text                                        -- if not null, an assertion that the path is content-addressed; see ValidPathInfo
);

-- =====
-- Create a table for combined Refs
-- =====

drop table if exists Refs;

create table Refs
(
    referrer  integer not null,
    reference integer not null,
    primary key (referrer, reference),
    foreign key (referrer) references ValidPaths (id) on delete cascade,
    foreign key (reference) references ValidPaths (id) on delete restrict
);

-- =====
-- Create a table for combined DerivationOutputs
-- =====

drop table if exists DerivationOutputs;

create table DerivationOutputs
(
    drv  integer not null, -- index of a path of a derivation in ValidPaths
    id   text    not null, -- symbolic output id, usually "out"
    path text    not null,
    primary key (drv, id),
    foreign key (drv) references ValidPaths (id) on delete cascade
);

-- =====
-- Create a table for combined Realisations
-- =====

drop table if exists Realisations;

create table Realisations (
    id integer primary key autoincrement not null,
    drvPath text not null,
    outputName text not null, -- symbolic output id, usually "out"
    outputPath integer not null,
    signatures text, -- space-separated list
    foreign key (outputPath) references ValidPaths(id) on delete cascade
);

-- =====
-- Create a table for combined RealisationsRefs
-- =====

drop table if exists RealisationsRefs;

create table RealisationsRefs (
    referrer integer not null,
    realisationReference integer,
    foreign key (referrer) references Realisations(id) on delete cascade,
    foreign key (realisationReference) references Realisations(id) on delete restrict
);

-- =====
-- Combine SchemaMigrations
-- =====

insert into SchemaMigrations (migration)
select migration
from SchemaMigrations1;

insert into SchemaMigrations (migration)
select migration
from SchemaMigrations2
where true
on conflict do nothing;

-- =====
-- Combine ValidPaths
-- =====

insert into ValidPaths
select *
from ValidPaths1;

-- Don't insert id as it'll be auto-generated.
insert into ValidPaths (path, hash, registrationTime, deriver, narSize, ultimate, sigs, ca)
select path, hash, registrationTime, deriver, narSize, ultimate, sigs, ca
from ValidPaths2 where true
on conflict (path) do nothing;

-- =====
-- Calculate updated ValidPaths ids for the second store
-- =====

drop view if exists ValidPathsIdMap;

-- "path" is unique, so we can use it
-- to calculate the mapping between the new and old ids

create view ValidPathsIdMap as
select ValidPaths_.idNew, ValidPaths2_.idOld from
(select id as idOld, path from ValidPaths2) as ValidPaths2_
    join (select id as idNew, path from ValidPaths) as ValidPaths_
        on ValidPaths2_.path = ValidPaths_.path;

-- =====
-- Combine Refs
-- =====

insert into Refs
select *
from Refs1;

insert into Refs (referrer, reference)
select
    referrerIdMap.idNew as referrer,
    referenceIdMap.idNew as reference
from
    Refs2
    join ValidPathsIdMap as referrerIdMap
        on referrerIdMap.idOld = Refs2.referrer
    join ValidPathsIdMap as referenceIdMap
        on referenceIdMap.idOld = Refs2.reference
on conflict (referrer, reference) do nothing;

-- =====
-- Combine DerivationOutputs
-- =====

insert into DerivationOutputs
select *
from DerivationOutputs1;

insert into DerivationOutputs (drv, id, path)
select 
    ValidPathsIdMap_.drvNew as drv,
    DerivationOutputs2_.id as id,
    DerivationOutputs2_.path as path
from (select drv as drvOld, id, path from DerivationOutputs2) as DerivationOutputs2_
    join (select idNew as drvNew, idOld as drvOld from ValidPathsIdMap) as ValidPathsIdMap_
        on DerivationOutputs2_.drvOld = ValidPathsIdMap_.drvOld
on conflict (drv, id) do nothing;

-- =====
-- Combine Realisations
-- =====

-- If you take the path in "ValidPaths" where the "id" is "outputPath"
-- and then get the "outputName" subdirectory of that path
-- the ca-hash (?) of that subdirectory will be "drvPath".

drop table if exists RealisationsUnique;

create table if not exists RealisationsUnique (
    id integer primary key autoincrement not null,
    drvPath text not null,
    outputName text not null, -- symbolic output id, usually "out"
    outputPath integer not null,
    signatures text, -- space-separated list
    
    idOld integer not null,
    
    unique(drvPath, outputName, outputPath)
);

insert into RealisationsUnique (id, drvPath, outputName, outputPath, signatures, idOld)
select id, drvPath, outputName, outputPath, signatures, id as idOld
from Realisations1;

-- We keep the "signatures" from the first store (there's no strong reason to do so, though).
-- Since we'll have to remap "id"-s in the "RealisationsRefs"
-- we need to replace "idOld"-s in "RealisationsUnique" with indices from "Realisations2".

insert into RealisationsUnique (drvPath, outputName, outputPath, signatures, idOld)
select drvPath, outputName, ValidPathsIdMap_.idNew as outputPath, signatures, Realisations2_.outputPath as idOld from (
    (select id as idOld, drvPath, outputName, outputPath, signatures from Realisations2) as Realisations2_
        join (select idNew, idOld from ValidPathsIdMap) as ValidPathsIdMap_
            on Realisations2_.outputPath = ValidPathsIdMap_.idOld
)
where true
on conflict(drvPath, outputName, outputPath) do
    update set idOld = excluded.idOld;

insert into Realisations (id, drvPath, outputName, outputPath, signatures)
select id, drvPath, outputName, outputPath, signatures
from RealisationsUnique;

-- =====
-- Combine RealisationsRefs
-- =====

drop table if exists RealisationsRefsUnique;

create table RealisationsRefsUnique (
    referrer integer not null,
    realisationReference integer,
    
    unique(referrer, realisationReference)
);

insert into RealisationsRefsUnique (referrer, realisationReference)
select referrer, realisationReference
from RealisationsRefs1;

drop view if exists RealisationsUniqueIdMap;

create view RealisationsUniqueIdMap as
select id as idNew, idOld
from RealisationsUnique;

insert into RealisationsRefsUnique (referrer, realisationReference)
select
    referrerMap.idNew as referrer,
    realisationReferenceMap.idNew as realisationReference
from 
    RealisationsRefs2
    join RealisationsUniqueIdMap as referrerMap
        on referrerMap.idOld = RealisationsRefs2.referrer
    join RealisationsUniqueIdMap as realisationReferenceMap
        on realisationReferenceMap.idOld = RealisationsRefs2.realisationReference
on conflict (referrer, realisationReference) do nothing;

insert into RealisationsRefs (referrer, realisationReference)
select referrer, realisationReference
from RealisationsRefsUnique;

-- =====
-- Create additional things
-- =====

create index IndexReferrer on Refs (referrer);
create index IndexReference on Refs (reference);
create index IndexDerivationOutputs on DerivationOutputs (path);
create index IndexRealisations on Realisations(drvPath, outputName);
create index IndexRealisationsRefsRealisationReference on RealisationsRefs(realisationReference);
create index IndexRealisationsRefs on RealisationsRefs(referrer);
create index IndexRealisationsRefsOnOutputPath on Realisations(outputPath);

create trigger DeleteSelfRefs
    before delete
    on ValidPaths
begin
    delete from Refs where referrer = old.id and reference = old.id;
end;

create trigger DeleteSelfRefsViaRealisations before delete on ValidPaths
  begin
    delete from RealisationsRefs where realisationReference in (
      select id from Realisations where outputPath = old.id
    );
end;

-- =====
-- Drop unnecessary tables
-- =====

drop table ValidPaths1;
drop table ValidPaths2;
drop table Refs1;
drop table Refs2;
drop table DerivationOutputs1;
drop table DerivationOutputs2;
drop table Realisations1;
drop table Realisations2;
drop table RealisationsRefs1;
drop table RealisationsRefs2;
drop table RealisationsUnique;
drop table RealisationsRefsUnique;

-- =====
-- Drop unnecessary views
-- =====

drop view ValidPathsIdMap;
drop view RealisationsUniqueIdMap;