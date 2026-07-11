export interface PlanePoint {
  x: number;
  y: number;
  z: number;
}

export interface PlaneFitResult {
  normal: [number, number, number];
  rms: number;
  method: 'exact' | 'pca';
}

function normalizeDirection(x: number, y: number, z: number): [number, number, number] {
  const length = Math.hypot(x, y, z);
  if (length <= 1e-12) {
    throw new Error('selected atoms are collinear; plane normal is undefined');
  }
  let normal: [number, number, number] = [x / length, y / length, z / length];
  let dominantIndex = 0;
  for (let i = 1; i < 3; i++) {
    if (Math.abs(normal[i]) > Math.abs(normal[dominantIndex])) {
      dominantIndex = i;
    }
  }
  if (normal[dominantIndex] < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }
  return normal;
}

/** Fit an exact three-point plane or a PCA least-squares plane for four or more points. */
export function fitPlane(points: PlanePoint[]): PlaneFitResult {
  if (points.length < 3) {
    throw new Error('non-zero normal offset requires at least three atoms');
  }
  if (points.length === 3) {
    const [a, b, c] = points;
    const ab = [b.x - a.x, b.y - a.y, b.z - a.z];
    const ac = [c.x - a.x, c.y - a.y, c.z - a.z];
    return {
      normal: normalizeDirection(
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0]
      ),
      rms: 0,
      method: 'exact',
    };
  }

  const centroid = points.reduce(
    (sum, point) => [sum[0] + point.x, sum[1] + point.y, sum[2] + point.z] as [number, number, number],
    [0, 0, 0] as [number, number, number]
  ).map((value) => value / points.length) as [number, number, number];
  const covariance = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const point of points) {
    const delta = [point.x - centroid[0], point.y - centroid[1], point.z - centroid[2]];
    for (let row = 0; row < 3; row++) {
      for (let column = row; column < 3; column++) {
        covariance[row][column] += delta[row] * delta[column];
        covariance[column][row] = covariance[row][column];
      }
    }
  }

  const eigenvectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 32; sweep++) {
    let p = 0;
    let q = 1;
    if (Math.abs(covariance[0][2]) > Math.abs(covariance[p][q])) {
      [p, q] = [0, 2];
    }
    if (Math.abs(covariance[1][2]) > Math.abs(covariance[p][q])) {
      [p, q] = [1, 2];
    }
    if (Math.abs(covariance[p][q]) <= 1e-14) {
      break;
    }
    const angle = 0.5 * Math.atan2(2 * covariance[p][q], covariance[q][q] - covariance[p][p]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const app = covariance[p][p];
    const aqq = covariance[q][q];
    const apq = covariance[p][q];
    covariance[p][p] = cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    covariance[q][q] = sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    covariance[p][q] = covariance[q][p] = 0;
    for (let index = 0; index < 3; index++) {
      if (index === p || index === q) {
        continue;
      }
      const aip = covariance[index][p];
      const aiq = covariance[index][q];
      covariance[index][p] = covariance[p][index] = cosine * aip - sine * aiq;
      covariance[index][q] = covariance[q][index] = sine * aip + cosine * aiq;
    }
    for (let row = 0; row < 3; row++) {
      const vip = eigenvectors[row][p];
      const viq = eigenvectors[row][q];
      eigenvectors[row][p] = cosine * vip - sine * viq;
      eigenvectors[row][q] = sine * vip + cosine * viq;
    }
  }

  const ordered = [0, 1, 2].sort((a, b) => covariance[a][a] - covariance[b][b]);
  const largest = Math.max(covariance[ordered[2]][ordered[2]], 1);
  if (covariance[ordered[1]][ordered[1]] <= largest * 1e-12) {
    throw new Error('selected atoms are collinear; plane normal is undefined');
  }
  const index = ordered[0];
  const normal = normalizeDirection(
    eigenvectors[0][index], eigenvectors[1][index], eigenvectors[2][index]
  );
  const sumSquares = points.reduce((sum, point) => {
    const distance = (point.x - centroid[0]) * normal[0]
      + (point.y - centroid[1]) * normal[1]
      + (point.z - centroid[2]) * normal[2];
    return sum + distance * distance;
  }, 0);
  return { normal, rms: Math.sqrt(sumSquares / points.length), method: 'pca' };
}
