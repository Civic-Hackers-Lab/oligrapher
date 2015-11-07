import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import BaseComponent from './BaseComponent';
import Node from './Node';
import Edge from './Edge';
import Caption from './Caption';
import { DraggableCore } from 'react-draggable';
import { values, min, max }  from 'lodash';

export default class Graph extends BaseComponent {
  constructor(props) {
    super(props);
    this.bindAll('_handleDragStart', '_handleDrag');
    this.nodes = {};
    this.edges = {};
    this.state = { x: 0, y: 0 };
    this.mounted = false;
  }

  render() {
    const { x, y, prevGraph, viewBox } = this.state;
    const transform = `translate(${x}, ${y})`;
    const markers = `<marker id="marker1" viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="#999"></path></marker><marker id="marker2" viewBox="-10 -5 10 10" refX="-8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L-10,0L0,5" fill="#999"></path></marker><marker id="fadedmarker1" viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5"></path></marker>`;

    return (
      <svg id="svg" version="1.1" xmlns="http://www.w3.org/2000/svg" className="Graph" width="100%" height={this.props.height} viewBox={viewBox} preserveAspectRatio="xMidYMid">
        <DraggableCore
          handle="#zoom-handle"
          moveOnStartChange={false}
          onStart={this._handleDragStart}
          onDrag={this._handleDrag}>
          <g id="zoom" transform={transform}>
            <rect id="zoom-handle" x="-5000" y="-5000" width="10000" height="10000" fill="#fff" />
            { values(this.props.graph.edges).map((e, i) =>  
              <Edge 
                ref={(c) => { this.edges[e.id] = c; if (c) { c.graphInstance = this; } }} 
                key={i} 
                edge={e} 
                graphId={this.props.graph.id} 
                zoom={this.props.zoom} 
                moveEdge={this.props.moveEdge} />) }
            { values(this.props.graph.nodes).map((n, i) => 
              <Node 
                ref={(c) => { this.nodes[n.id] = c; if (c) { c.graphInstance = this; } }} 
                key={i} 
                node={n} 
                graph={this.props.graph} 
                zoom={this.props.zoom} 
                clickNode={this.props.clickNode} 
                moveNode={this.props.moveNode} />) }
            { values(this.props.graph.captions).map((c, i) => 
              <Caption 
                ref={(c) => { if (c) { c.graphInstance = this; } }}
                key={i} 
                caption={c}
                graphId={this.props.graph.id}
                moveCaption={this.props.moveCaption} />) }
          </g>
        </DraggableCore>
        <defs dangerouslySetInnerHTML={ { __html: markers } }/>
      </svg>
    );
  }
  
  componentWillMount() {
    this._updateViewbox(this.props.graph, this.props.zoom);
  }

  componentDidMount() {
    ReactDOM.findDOMNode(this).setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    this._animateTransition();
    this.mounted = true;
    this._updateActualZoom(this.state.viewBox);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.graph.id === this.props.graph.id) {
      this._updateViewbox(nextProps.graph, nextProps.zoom);
    } else {
      this.setState({ prevGraph: this.props.graph });      
    }
  }

  componentDidUpdate() {
    this._animateTransition();
  }

  _updateViewbox(graph, zoom) {
    let viewBox = this._computeViewbox(graph, zoom);
    this.setState({ viewBox });
    this._updateActualZoom(viewBox);
  }

  _updateActualZoom(viewBox) {
    if (this.mounted) {
      let [x, y, w, h] = viewBox.split(" ").map(i => parseInt(i));
      let domNode = ReactDOM.findDOMNode(this);
      let svgWidth = domNode.offsetWidth;;
      let svgHeight = domNode.offsetHeight;;
      let xFactor = svgWidth / w;
      let yFactor = svgHeight / h;
      let actualZoom = Math.min(xFactor, yFactor);
      this.setState({ actualZoom });
    }
  }

  _handleDragStart(e, ui) {
    this._startDrag = ui.position;
    this._startPosition = {
      x: this.state.x,
      y: this.state.y
    };
  }

  _handleDrag(e, ui) {
    let deltaX = (ui.position.clientX - this._startDrag.clientX) / this.state.actualZoom;
    let deltaY = (ui.position.clientY - this._startDrag.clientY) / this.state.actualZoom;
    let x = deltaX + this._startPosition.x;
    let y = deltaY + this._startPosition.y;
    this.setState({ x, y });
  }

  _animateTransition(duration = 0.7) {
    let { graph, zoom } = this.props;
    let { prevGraph } = this.state;

    if (!this._isSmallDevice() && prevGraph) {
      this.props.resetZoom();

      let oldViewbox = this._computeViewbox(prevGraph, zoom).split(" ").map(part => parseInt(part));
      let newViewbox = this._computeViewbox(graph, zoom).split(" ").map(part => parseInt(part));
      let start = this._now();
      let that = this;
      let domNode = ReactDOM.findDOMNode(that);
      let req;

      const draw = () => {
        req = requestAnimationFrame(draw);

        let time = (that._now() - start);
        let viewbox = oldViewbox.map((part, i) => { 
          return oldViewbox[i] + (newViewbox[i] - oldViewbox[i]) * that._linear(time / duration);
        }).join(" ");

        domNode.setAttribute("viewBox", viewbox);

        if (time > duration) {
          cancelAnimationFrame(req);
        }
      };

      requestAnimationFrame(draw);

    } else {
      ReactDOM.findDOMNode(this).setAttribute("viewBox", this.state.viewBox);
    }
  }

  _linear(t) {
    return t;
  }

  _easeInOutQuad(t) { 
    return (t < .5) ? (2 * t * t) : (-1 + (4 - 2 * t) * t);
  }

  _now() {
    return new Date().getTime() / 1000;
  }

  _computeViewbox(graph, zoom = 1.2) {
    let highlightedOnly = true;
    let rect = this._computeRect(graph, highlightedOnly);
    let w = rect.w / zoom;
    let h = rect.h / zoom;
    let x = rect.x + rect.w/2 - (w/2);
    let y = rect.y + rect.h/2 - (h/2);

    return `${x} ${y} ${w} ${h}`;
  }

  _computeRect(graph, highlightedOnly = true) {
    const nodes = values(graph.nodes)
      .filter(n => !highlightedOnly || n.display.status != "faded")
      .map(n => n.display);
    const items = nodes.concat(...values(graph.captions).map(c => c.display));

    if (items.length > 0) {
      const padding = highlightedOnly ? 50 : 50;
      const xs = items.map(i => i.x);
      const ys = items.map(i => i.y);
      const textPadding = 100; // node text might extend below node
      return { 
        x: min(xs) - padding, 
        y: min(ys) - padding, 
        w: max(xs) - min(xs) + padding * 2, 
        h: max(ys) - min(ys) + textPadding + padding
      };
    } else {
      return { x: 0, y: 0, w: 0, h: 0 };
    }
  }


  _isSmallDevice() {
    return window.innerWidth < 600;
  }
}