-- =====
-- Get tables from store databases
-- =====

attach database '{{ dbPath1 }}' as store1;

attach database '{{ dbPath2 }}' as store2;

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

detach database store1;

detach database store2;

-- =====
-- Create a table for combined valid paths from both stores
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
-- Create a table for combined refs from both stores
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
-- Create a table for combined derivation outputs from both stores
-- =====

drop table if exists DerivationOutputs;

create table DerivationOutputs
(
    drv  integer not null,
    id   text    not null, -- symbolic output id, usually "out"
    path text    not null,
    primary key (drv, id),
    foreign key (drv) references ValidPaths (id) on delete cascade
);

-- =====
-- Insert paths from both stores
-- =====

insert into ValidPaths
select *
from ValidPaths1;

-- don't insert id as it'll be auto-generated
insert into ValidPaths (path, hash, registrationTime, deriver, narSize, ultimate, sigs, ca)
select path,
       hash,
       registrationTime,
       deriver,
       narSize,
       ultimate,
       sigs,
       ca
from ValidPaths2
where hash not in (select hash from ValidPaths);

-- =====
-- Insert refs from the first store
-- =====

insert into Refs
select *
from Refs1;

-- =====
-- Calculate updated refs for the second store
-- =====

-- referrer | hash
drop view if exists ReferrerHash;

create view ReferrerHash as
select distinct referrer, hash
from Refs2
         join (select hash, id from ValidPaths2) as ValidPaths2_ on Refs2.referrer = ValidPaths2_.id;

-- referrer | new referrer
drop view if exists ReferrerId;

create view ReferrerId as
select referrer, referrerNew
from ReferrerHash
         join (select hash, id as referrerNew from ValidPaths) as ValidPaths_ on ReferrerHash.hash = ValidPaths_.hash;

-- reference | hash
drop view if exists ReferenceHash;

create view ReferenceHash as
select distinct reference, hash
from Refs2
         join (select hash, id from ValidPaths2) as ValidPaths2_ on Refs2.reference = ValidPaths2_.id;

-- reference | new reference
drop view if exists ReferenceId;

create view ReferenceId as
select reference, referenceNew
from ReferenceHash
         join (select hash, id as referenceNew from ValidPaths) as ValidPaths_ on ReferenceHash.hash = ValidPaths_.hash;

-- referrer | new referrer | reference
drop view if exists ReferrerReferrerIdReference;

create view ReferrerReferrerIdReference as
select distinct Refs2.referrer, ReferrerId.referrerNew, reference
from Refs2
         join ReferrerId on Refs2.referrer = ReferrerId.referrer;

-- referrer | new referrer | reference | new reference
drop view if exists ReferrerReferrerIdReferenceReferenceId;

create view ReferrerReferrerIdReferenceReferenceId as
select distinct referrer, referrerNew, ReferrerReferrerIdReference.reference, referenceNew
from ReferrerReferrerIdReference
         join ReferenceId on ReferrerReferrerIdReference.reference = ReferenceId.reference;

-- new referrer | new reference
drop view if exists Refs2Updated;

create view Refs2Updated as
select distinct referrerNew as referrer, referenceNew as reference
from ReferrerReferrerIdReferenceReferenceId;

-- =====
-- Insert updated refs from the second store
-- =====

insert or ignore into Refs
select *
from Refs2Updated;

-- =====
-- Insert derivation outputs from the first store
-- =====

insert into DerivationOutputs
select *
from DerivationOutputs1;

-- =====
-- Calculate updated derivation outputs for the second store
-- =====

-- drv | id | path | hash
drop view if exists DerivationOutputsHash;


-- TODO what is drv?

create view DerivationOutputsHash as
select drv, DerivationOutputs2.id, path, hash
from DerivationOutputs2
         join (select id, hash from ValidPaths2) as ValidPaths2_ on ValidPaths2_.id = drv;

-- new drv | id | path
drop view if exists DerivationOutputs2Updated;

create view DerivationOutputs2Updated as
select ValidPaths_.drvNew as drv, id, path
from (select id, path, hash from DerivationOutputsHash) as DerivationOutputsHash_
         join (select id as drvNew, hash from ValidPaths) as ValidPaths_
              on DerivationOutputsHash_.hash = ValidPaths_.hash;

-- =====
-- Insert updated derivation outputs from the second store
-- =====

insert or ignore into DerivationOutputs
select *
from DerivationOutputs2Updated;

-- =====
-- Create additional things
-- =====

create index IndexReferrer on Refs (referrer);
create index IndexReference on Refs (reference);
create trigger DeleteSelfRefs
    before delete
    on ValidPaths
begin
    delete from Refs where referrer = old.id and reference = old.id;
end;
create index IndexDerivationOutputs on DerivationOutputs (path);

-- =====
-- Drop old tables
-- =====

drop table ValidPaths1;
drop table ValidPaths2;
drop table DerivationOutputs1;
drop table DerivationOutputs2;
drop table Refs1;
drop table Refs2;

-- =====
-- Drop old views
-- =====

drop view DerivationOutputs2Updated;
drop view DerivationOutputsHash;
drop view ReferenceHash;
drop view ReferenceId;
drop view ReferrerHash;
drop view ReferrerId;
drop view ReferrerReferrerIdReference;
drop view ReferrerReferrerIdReferenceReferenceId;
drop view Refs2Updated;