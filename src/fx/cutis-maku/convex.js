// three's ConvexGeometry (examples/jsm/geometries/ConvexGeometry.js, r160, MIT) over the vendored ConvexHull; flat-shaded, unindexed.
import { BufferGeometry, Float32BufferAttribute } from '../../../vendor/three.module.js';
import { ConvexHull } from '../../../vendor/ConvexHull.js';

export class ConvexGeometry extends BufferGeometry {
  constructor(points=[]) {
    super();
    const vertices=[],normals=[];
    for(const face of new ConvexHull().setFromPoints(points).faces){
      let edge=face.edge;
      do{
        const point=edge.head().point;
        vertices.push(point.x,point.y,point.z);
        normals.push(face.normal.x,face.normal.y,face.normal.z);
        edge=edge.next;
      }while(edge!==face.edge);
    }
    this.setAttribute('position',new Float32BufferAttribute(vertices,3));
    this.setAttribute('normal',new Float32BufferAttribute(normals,3));
  }
}
