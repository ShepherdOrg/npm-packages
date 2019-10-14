#Postgres backend for state store.
Simple key-value store with last update timestamp.

## ToDo

### History table
Might want to add a history table to keep track of when things were deployed.
Would complement version control, since it could tell when things are deployed
due to configuration changes or version change.

### Migrations
Database is not maintained yet using migrations. If more changes are required,
consider moving to a separate user/schema and use migration tool to maintain 
database.