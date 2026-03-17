#!/bin/bash
mysqld \
--datadir=/workspaces/mysql-data \
--socket=/workspaces/mysql-data/mysql.sock \
--port=3306
