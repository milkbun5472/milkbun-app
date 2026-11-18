"""Reproduce the smaller Float64 L D L^T factors from fixed original operators.
Usage: python refactor_factors.py ORIGINAL_RESEARCH_DATA --output OUTPUT_DIRECTORY
The unchanged geometry/context/RHS metadata comes from the original JSON files.
"""
from pathlib import Path
import argparse,gzip,json,hashlib,numpy as np
from scipy.sparse import load_npz,csr_matrix
from scipy.sparse.linalg import splu,spsolve_triangular

def main():
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('--output',required=True,type=Path);args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    here=Path(__file__).parent;manifest=json.loads((here/'operators/manifest.json').read_text());report=[]
    for name,expected in manifest.items():
        raw=(args.source/name).read_bytes();operator=here/'operators'/expected['operator']
        assert hashlib.sha256(raw).hexdigest()==expected['sourceSha256'],f'Changed source: {name}'
        assert hashlib.sha256(operator.read_bytes()).hexdigest()==expected['operatorSha256'],f'Changed operator: {name}'
        data=json.loads(gzip.decompress(raw) if name.endswith('.gz') else raw);A=load_npz(operator);old=splu(A);lu=splu(A,permc_spec='MMD_AT_PLUS_A',diag_pivot_thresh=0,options={'SymmetricMode':True});D=lu.U.diagonal()
        assert np.array_equal(lu.perm_r,lu.perm_c) and np.all(D>0)
        R=csr_matrix((data['rhs']['value'],data['rhs']['col'],data['rhs']['ptr']));maximum=0
        for frequency in [.001,.1,17.4]:
            rhs=R@np.sin(np.arange(R.shape[1]*3).reshape(-1,3)*frequency);pb=np.empty_like(rhs);pb[lu.perm_r]=rhs
            y=spsolve_triangular(lu.L,pb,lower=True,unit_diagonal=True)/D[:,None]
            y=spsolve_triangular(lu.L.T.tocsr(),y,lower=False,unit_diagonal=True)[lu.perm_c]
            maximum=max(maximum,float(abs(y-old.solve(rhs)).max()))
        assert maximum<2e-8,(name,maximum)
        L=lu.L.tocsr();data.update(L=dict(ptr=L.indptr.tolist(),col=L.indices.tolist(),value=L.data.tolist()),diagonal=D.tolist(),symmetricFactor=True,permR=lu.perm_r.tolist(),permC=lu.perm_c.tolist());data.pop('U')
        out=json.dumps(data,separators=(',',':')).encode();target=name.replace('.json','-symmetric.json');(args.output/target).write_bytes(gzip.compress(out,mtime=0) if target.endswith('.gz') else out)
        report.append(dict(name=name,maximumSolveDifference=maximum,storedFactorEntries=L.nnz))
    (args.output/'symmetric-factor-validation.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
