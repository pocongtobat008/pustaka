const React = require('react');
const ReactDOMServer = require('react-dom/server');
const { Grid, List } = require('react-window');

const Cell = ({ columnIndex, rowIndex, style, data }) => {
    return React.createElement('div', { style }, `Cell ${rowIndex},${columnIndex}`);
};

const el = React.createElement(Grid, {
    columnCount: 2,
    rowCount: 2,
    columnWidth: 100,
    rowHeight: 100,
    cellComponent: Cell,
    cellProps: { test: 1 },
    style: { height: 200, width: 200 }
});

console.log("GRID OUTPUT:");
console.log(ReactDOMServer.renderToString(el));

const Row = ({ index, style, data }) => {
    return React.createElement('div', { style }, `Row ${index}`);
};

const elList = React.createElement(List, {
    rowCount: 2,
    rowHeight: 100,
    rowComponent: Row,
    rowProps: { test: 2 },
    style: { height: 200, width: 200 }
});

console.log("LIST OUTPUT:");
console.log(ReactDOMServer.renderToString(elList));
