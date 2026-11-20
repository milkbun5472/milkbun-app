// Numeric kernel only. CSR factors are validated and owned by the JS adapter.
@inline function num(p:usize,i:i32):f64{return load<f64>(p+usize(i)*8);}
@inline function ix(p:usize,i:i32):i32{return load<i32>(p+usize(i)*4);}
@inline function put(p:usize,i:i32,v:f64):void{store<f64>(p+usize(i)*8,v);}
export function solve(n:i32,rp:usize,rc:usize,rv:usize,lp:usize,lc:usize,lv:usize,up:usize,uc:usize,uv:usize,pr:usize,pc:usize,q:usize,work:usize,out:usize):void{
 for(let i=0;i<n;i++){
  let a:f64=0,b:f64=0,c:f64=0;
  for(let j=ix(rp,i);j<ix(rp,i+1);j++){const k=ix(rc,j)*3,v=num(rv,j);a+=v*num(q,k);b+=v*num(q,k+1);c+=v*num(q,k+2);}
  const k=ix(pr,i)*3;put(work,k,a);put(work,k+1,b);put(work,k+2,c);
 }
 for(let i=0;i<n;i++){
  const k=i*3;let a=num(work,k),b=num(work,k+1),c=num(work,k+2),diag:f64=0;
  for(let j=ix(lp,i);j<ix(lp,i+1);j++){const col=ix(lc,j),v=num(lv,j);if(col==i){diag=v;continue;}const h=col*3;a-=v*num(work,h);b-=v*num(work,h+1);c-=v*num(work,h+2);}
  put(work,k,a/diag);put(work,k+1,b/diag);put(work,k+2,c/diag);
 }
 for(let i=n-1;i>=0;i--){
  const k=i*3;let a=num(work,k),b=num(work,k+1),c=num(work,k+2),diag:f64=0;
  for(let j=ix(up,i);j<ix(up,i+1);j++){const col=ix(uc,j),v=num(uv,j);if(col==i){diag=v;continue;}const h=col*3;a-=v*num(work,h);b-=v*num(work,h+1);c-=v*num(work,h+2);}
  put(work,k,a/diag);put(work,k+1,b/diag);put(work,k+2,c/diag);
 }
 for(let i=0;i<n;i++){const k=i*3,h=ix(pc,i)*3;put(out,k,num(work,h));put(out,k+1,num(work,h+1));put(out,k+2,num(work,h+2));}
}

// Minimum of A cos(t) + B sin(t) + C on a finite angular interval.
@inline function minProjection(a:f64,b:f64,c:f64,end:f64):f64{
 let result=Math.min(a+c,a*Math.cos(end)+b*Math.sin(end)+c),t=Math.atan2(b,a)+Math.PI;
 if(t>=2*Math.PI)t-=2*Math.PI;if(t>=0&&t<=end)result=Math.min(result,-Math.sqrt(a*a+b*b)+c);return result;
}
// Same RK4 elbow flow as the validated authoring solver, in double precision.
export function jointFlow(count:i32,points:usize,planes:usize,rx0:f64,ry0:f64,rz0:f64,width:f64,result:usize):void{
 const dt:f64=1.0/16.0,angle=Math.sqrt(rx0*rx0+ry0*ry0+rz0*rz0),ux=angle>0?rx0/angle:0,uy=angle>0?ry0/angle:0,uz=angle>0?rz0/angle:0,dx=num(planes,0),dy=num(planes,1),dz=num(planes,2),da=dx*ux+dy*uy+dz*uz;
 let compatible=angle<=Math.PI+1e-8;
 for(let j=1;j<33&&compatible;j++){const t=angle*j/64,c=Math.cos(t),s=Math.sin(t),px=dx*c+(uy*dz-uz*dy)*s+ux*da*(1-c),py=dy*c+(uz*dx-ux*dz)*s+uy*da*(1-c),pz=dz*c+(ux*dy-uy*dx)*s+uz*da*(1-c);if(Math.abs(px-num(planes,j*3))+Math.abs(py-num(planes,j*3+1))+Math.abs(pz-num(planes,j*3+2))>1e-10)compatible=false;}
 const h=angle*dt,h2=h*h;let rc=1-h2/2+h2*h2/24,rs=h-h*h2/6;
 for(let j=0;j<4;j++){const c=rc*rc-rs*rs;rs=2*rc*rs;rc=c;}
 for(let i=0;i<count;i++){let x=num(points,i*3),y=num(points,i*3+1),z=num(points,i*3+2);
   if(compatible){
    const dot=ux*x+uy*y+uz*z,c=da*dot,a=dx*x+dy*y+dz*z-c,b=dx*(uy*z-uz*y)+dy*(uz*x-ux*z)+dz*(ux*y-uy*x),margin=1e-7+(.001+h2)*Math.sqrt(x*x+y*y+z*z);
    // Outside the transition, RK4 is a fixed linear operator. Its sixteenth
    // power is reused exactly; this is not a lower-step approximation.
    if(minProjection(a,b,c,angle*.5)>width+margin){const xx=rc*x+(1-rc)*ux*dot+rs*(uy*z-uz*y),yy=rc*y+(1-rc)*uy*dot+rs*(uz*x-ux*z),zz=rc*z+(1-rc)*uz*dot+rs*(ux*y-uy*x);put(result,i*3,xx);put(result,i*3+1,yy);put(result,i*3+2,zz);continue;}
    if(-minProjection(-a,b,-c,angle*.5)<-width-margin){put(result,i*3,x);put(result,i*3+1,y);put(result,i*3+2,z);continue;}
   }
   for(let step=0;step<16;step++){const j=step*6;let xx=x,yy=y,zz=z;
const p1=j,s1=Math.max(0,Math.min(1,(xx*num(planes,p1)+yy*num(planes,p1+1)+zz*num(planes,p1+2)+width)/(2*width))),w1=s1*s1*(3-2*s1),k1x=(ry0*zz-rz0*yy)*w1,k1y=(rz0*xx-rx0*zz)*w1,k1z=(rx0*yy-ry0*xx)*w1;
xx=x+k1x*dt*.5;yy=y+k1y*dt*.5;zz=z+k1z*dt*.5;
const p2=j+3,s2=Math.max(0,Math.min(1,(xx*num(planes,p2)+yy*num(planes,p2+1)+zz*num(planes,p2+2)+width)/(2*width))),w2=s2*s2*(3-2*s2),k2x=(ry0*zz-rz0*yy)*w2,k2y=(rz0*xx-rx0*zz)*w2,k2z=(rx0*yy-ry0*xx)*w2;
xx=x+k2x*dt*.5;yy=y+k2y*dt*.5;zz=z+k2z*dt*.5;
const p3=j+3,s3=Math.max(0,Math.min(1,(xx*num(planes,p3)+yy*num(planes,p3+1)+zz*num(planes,p3+2)+width)/(2*width))),w3=s3*s3*(3-2*s3),k3x=(ry0*zz-rz0*yy)*w3,k3y=(rz0*xx-rx0*zz)*w3,k3z=(rx0*yy-ry0*xx)*w3;
xx=x+k3x*dt;yy=y+k3y*dt;zz=z+k3z*dt;
const p4=j+6,s4=Math.max(0,Math.min(1,(xx*num(planes,p4)+yy*num(planes,p4+1)+zz*num(planes,p4+2)+width)/(2*width))),w4=s4*s4*(3-2*s4),k4x=(ry0*zz-rz0*yy)*w4,k4y=(rz0*xx-rx0*zz)*w4,k4z=(rx0*yy-ry0*xx)*w4;
x+=dt/6*(k1x+2*k2x+2*k3x+k4x);y+=dt/6*(k1y+2*k2y+2*k3y+k4y);z+=dt/6*(k1z+2*k2z+2*k3z+k4z)}
 put(result,i*3,x);put(result,i*3+1,y);put(result,i*3+2,z);
 }
}

// Symmetric positive-definite operator: P A P^T = L D L^T.
// Store one triangular factor, and reuse it for the backward scatter solve.
export function solveSymmetric(n:i32,rp:usize,rc:usize,rv:usize,lp:usize,lc:usize,lv:usize,pr:usize,diag:usize,q:usize,work:usize,out:usize):void{
 for(let i=0;i<n;i++){let a:f64=0,b:f64=0,c:f64=0;for(let j=ix(rp,i);j<ix(rp,i+1);j++){const k=ix(rc,j)*3,v=num(rv,j);a+=v*num(q,k);b+=v*num(q,k+1);c+=v*num(q,k+2);}const k=ix(pr,i)*3;put(work,k,a);put(work,k+1,b);put(work,k+2,c);}
 for(let i=0;i<n;i++){const k=i*3;let a=num(work,k),b=num(work,k+1),c=num(work,k+2);for(let j=ix(lp,i);j<ix(lp,i+1);j++){const col=ix(lc,j);if(col==i)continue;const h=col*3,v=num(lv,j);a-=v*num(work,h);b-=v*num(work,h+1);c-=v*num(work,h+2);}put(work,k,a);put(work,k+1,b);put(work,k+2,c);}
 for(let i=0;i<n;i++){const d=num(diag,i),k=i*3;put(work,k,num(work,k)/d);put(work,k+1,num(work,k+1)/d);put(work,k+2,num(work,k+2)/d);}
 for(let i=n-1;i>=0;i--){const k=i*3,a=num(work,k),b=num(work,k+1),c=num(work,k+2);for(let j=ix(lp,i);j<ix(lp,i+1);j++){const col=ix(lc,j);if(col==i)continue;const h=col*3,v=num(lv,j);put(work,h,num(work,h)-v*a);put(work,h+1,num(work,h+1)-v*b);put(work,h+2,num(work,h+2)-v*c);}}
 for(let i=0;i<n;i++){const k=i*3,h=ix(pr,i)*3;put(out,k,num(work,h));put(out,k+1,num(work,h+1));put(out,k+2,num(work,h+2));}
}

// Posed garment normals, preserving double-precision Three.js evaluation order.
export function clothNormals(count:i32,faceCount:i32,groupCount:i32,morphCount:i32,pos:usize,normal:usize,mp:usize,mn:usize,mw:usize,si:usize,sw:usize,bones:usize,exact:usize,bind:usize,unbind:usize,faces:usize,weld:usize,mask:usize,activation:f64,posed:usize,skin:usize,normals:usize,joined:usize):void{
 for(let i=0;i<count;i++){
  const p=i*3,h=i*12;let dx:f64=0,dy:f64=0,dz:f64=0;
  for(let k=0;k<morphCount;k++){const w=num(mw,k);if(w==0)continue;const a=k*count*3+p;dx+=w*num(mp,a);dy+=w*num(mp,a+1);dz+=w*num(mp,a+2);}
  const x=num(pos,p)+dx,y=num(pos,p+1)+dy,z=num(pos,p+2)+dz,bw=1/(num(bind,3)*x+num(bind,7)*y+num(bind,11)*z+num(bind,15)),bx=(num(bind,0)*x+num(bind,4)*y+num(bind,8)*z+num(bind,12))*bw,by=(num(bind,1)*x+num(bind,5)*y+num(bind,9)*z+num(bind,13))*bw,bz=(num(bind,2)*x+num(bind,6)*y+num(bind,10)*z+num(bind,14))*bw;
  let px:f64=0,py:f64=0,pz:f64=0;
  for(let j=0;j<12;j++)put(skin,h+j,0);
  for(let k=0;k<4;k++){
   const w=num(sw,i*4+k);if(w==0)continue;const j=ix(si,i*4+k)*16,m=bones+usize(j)*8,e=exact+usize(j)*8,ew=1/(num(e,3)*bx+num(e,7)*by+num(e,11)*bz+num(e,15));
   px+=(num(e,0)*bx+num(e,4)*by+num(e,8)*bz+num(e,12))*ew*w;py+=(num(e,1)*bx+num(e,5)*by+num(e,9)*bz+num(e,13))*ew*w;pz+=(num(e,2)*bx+num(e,6)*by+num(e,10)*bz+num(e,14))*ew*w;
   for(let t=0;t<4;t++)for(let j=0;j<3;j++)put(skin,h+t*3+j,num(skin,h+t*3+j)+w*num(m,t*4+j));
  }
  const uw=1/(num(unbind,3)*px+num(unbind,7)*py+num(unbind,11)*pz+num(unbind,15));put(posed,p,(num(unbind,0)*px+num(unbind,4)*py+num(unbind,8)*pz+num(unbind,12))*uw);put(posed,p+1,(num(unbind,1)*px+num(unbind,5)*py+num(unbind,9)*pz+num(unbind,13))*uw);put(posed,p+2,(num(unbind,2)*px+num(unbind,6)*py+num(unbind,10)*pz+num(unbind,14))*uw);
 }
 memory.fill(normals,0,usize(count)*24);memory.fill(joined,0,usize(groupCount)*24);
 for(let k=0;k<faceCount;k+=3){const a=ix(faces,k)*3,b=ix(faces,k+1)*3,c=ix(faces,k+2)*3,ux=num(posed,b)-num(posed,a),uy=num(posed,b+1)-num(posed,a+1),uz=num(posed,b+2)-num(posed,a+2),vx=num(posed,c)-num(posed,a),vy=num(posed,c+1)-num(posed,a+1),vz=num(posed,c+2)-num(posed,a+2),nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  put(normals,a,num(normals,a)+nx);put(normals,a+1,num(normals,a+1)+ny);put(normals,a+2,num(normals,a+2)+nz);put(normals,b,num(normals,b)+nx);put(normals,b+1,num(normals,b+1)+ny);put(normals,b+2,num(normals,b+2)+nz);put(normals,c,num(normals,c)+nx);put(normals,c+1,num(normals,c+1)+ny);put(normals,c+2,num(normals,c+2)+nz);
 }
 for(let i=0;i<count;i++){const j=ix(weld,i)*3,p=i*3;for(let k=0;k<3;k++)put(joined,j+k,num(joined,j+k)+num(normals,p+k));}
 for(let i=0;i<count;i++){
  const blend=num(mask,i)*activation;if(blend==0)continue;const h=i*12,p=i*3,j=ix(weld,i)*3,a=num(skin,h),b=num(skin,h+3),c=num(skin,h+6),d=num(skin,h+1),e=num(skin,h+4),f=num(skin,h+7),g=num(skin,h+2),h1=num(skin,h+5),k=num(skin,h+8),A=e*k-f*h1,B=c*h1-b*k,C=b*f-c*e,D=f*g-d*k,E=a*k-c*g,F=c*d-a*f,G=d*h1-e*g,H=b*g-a*h1,I=a*e-b*d,det=a*A+b*D+c*G;
  let x:f64=0,y:f64=0,z:f64=0;
  if(det!=0){x=(A*num(joined,j)+B*num(joined,j+1)+C*num(joined,j+2))/det;y=(D*num(joined,j)+E*num(joined,j+1)+F*num(joined,j+2))/det;z=(G*num(joined,j)+H*num(joined,j+1)+I*num(joined,j+2))/det;let len=Math.sqrt(x*x+y*y+z*z);if(len==0)len=1;x/=len;y/=len;z/=len;}
  for(let k=0;k<morphCount;k++){const w=num(mw,k);if(w==0)continue;const a=k*count*3+p;x-=w*num(mn,a);y-=w*num(mn,a+1);z-=w*num(mn,a+2);}
  put(normal,p,num(normal,p)+(x-num(normal,p))*blend);put(normal,p+1,num(normal,p+1)+(y-num(normal,p+1))*blend);put(normal,p+2,num(normal,p+2)+(z-num(normal,p+2))*blend);
 }
}

@inline function small(p:usize,i:i32):f64{return f64(load<f32>(p+usize(i)*4));}
export function bodyPose(n:i32,src:usize,mp:usize,mw:usize,morphCount:i32,si:usize,sw:usize,mats:usize,linear:usize,inverse:usize,translation:usize,buffer:usize,same:bool):i32{
 for(let i=0;i<n;i++){
  const k=i*3,h=i*9;let x=small(src,k),y=small(src,k+1),z=small(src,k+2);
  for(let j=0;j<morphCount;j++){const w=num(mw,j);if(w==0)continue;const r=j*n*3+k;x+=w*small(mp,r);y+=w*small(mp,r+1);z+=w*small(mp,r+2);}
  if(same){put(buffer,k,num(linear,h)*x+num(linear,h+3)*y+num(linear,h+6)*z+num(translation,k));put(buffer,k+1,num(linear,h+1)*x+num(linear,h+4)*y+num(linear,h+7)*z+num(translation,k+1));put(buffer,k+2,num(linear,h+2)*x+num(linear,h+5)*y+num(linear,h+8)*z+num(translation,k+2));continue;}
  let a:f64=0,b:f64=0,c:f64=0,d:f64=0,e:f64=0,f:f64=0,j:f64=0,l:f64=0,m:f64=0,tx:f64=0,ty:f64=0,tz:f64=0;
  for(let s=0;s<4;s++){const w=num(sw,i*4+s);if(w==0)continue;const v=mats+usize(ix(si,i*4+s))*128;a+=w*num(v,0);b+=w*num(v,1);c+=w*num(v,2);d+=w*num(v,4);e+=w*num(v,5);f+=w*num(v,6);j+=w*num(v,8);l+=w*num(v,9);m+=w*num(v,10);tx+=w*num(v,12);ty+=w*num(v,13);tz+=w*num(v,14);}
  put(linear,h,a);put(linear,h+1,b);put(linear,h+2,c);put(linear,h+3,d);put(linear,h+4,e);put(linear,h+5,f);put(linear,h+6,j);put(linear,h+7,l);put(linear,h+8,m);put(translation,k,tx);put(translation,k+1,ty);put(translation,k+2,tz);put(buffer,k,a*x+d*y+j*z+tx);put(buffer,k+1,b*x+e*y+l*z+ty);put(buffer,k+2,c*x+f*y+m*z+tz);
  const A=e*m-l*f,B=j*f-d*m,C=d*l-j*e,D=l*c-b*m,E=a*m-j*c,F=j*b-a*l,G=b*f-e*c,H=d*c-a*f,I=a*e-d*b,det=a*A+d*D+j*G;if(Math.abs(det)<1e-7)return 0;
  put(inverse,h,A/det);put(inverse,h+1,D/det);put(inverse,h+2,G/det);put(inverse,h+3,B/det);put(inverse,h+4,E/det);put(inverse,h+5,H/det);put(inverse,h+6,C/det);put(inverse,h+7,F/det);put(inverse,h+8,I/det);
 }
 return 1;
}

@inline function rotate(out:usize,k:i32,x:f64,y:f64,z:f64,qx:f64,qy:f64,qz:f64,qw:f64):void{
 const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);put(out,k,x+qw*tx+qy*tz-qz*ty);put(out,k+1,y+qw*ty+qz*tx-qx*tz);put(out,k+2,z+qw*tz+qx*ty-qy*tx);
}
export function clothDeform(count:i32,ids:usize,rest:usize,normal:usize,si:usize,sw:usize,references:usize,qr:usize,qd:usize,virtual:usize,left:f64,right:f64,out:usize,outN:usize):void{
 for(let h=0;h<count;h++){
  const i=ix(ids,h),k=i*3,t=i*4,ref=ix(references,i)*4;
  let rx:f64=0,ry:f64=0,rz:f64=0,rw:f64=0,dx:f64=0,dy:f64=0,dz:f64=0,dw:f64=0;
  for(let j=0;j<4;j++){const b=ix(si,t+j)*4,w=num(sw,t+j),dot=num(qr,b)*num(qr,ref)+num(qr,b+1)*num(qr,ref+1)+num(qr,b+2)*num(qr,ref+2)+num(qr,b+3)*num(qr,ref+3),z=w*(dot<0?-1:1);rx+=z*num(qr,b);ry+=z*num(qr,b+1);rz+=z*num(qr,b+2);rw+=z*num(qr,b+3);dx+=z*num(qd,b);dy+=z*num(qd,b+1);dz+=z*num(qd,b+2);dw+=z*num(qd,b+3);}
  const len=Math.sqrt(rx*rx+ry*ry+rz*rz+rw*rw);rx/=len;ry/=len;rz/=len;rw/=len;dx/=len;dy/=len;dz/=len;dw/=len;const dot=rx*dx+ry*dy+rz*dz+rw*dw;dx-=rx*dot;dy-=ry*dot;dz-=rz*dot;dw-=rw*dot;
  const tx=dx*rw-dw*rx-dy*rz+dz*ry,ty=dy*rw-dw*ry-dz*rx+dx*rz,tz=dz*rw-dw*rz-dx*ry+dy*rx,x=num(rest,k),y=num(rest,k+1),z=num(rest,k+2);
  rotate(out,k,x,y,z,rx,ry,rz,rw);put(out,k,num(out,k)+tx*2);put(out,k+1,num(out,k+1)+ty*2);put(out,k+2,num(out,k+2)+tz*2);rotate(outN,k,num(normal,k),num(normal,k+1),num(normal,k+2),rx,ry,rz,rw);
  const f=x<0?left:right;if(f!=0){let px:f64=0,py:f64=0,pz:f64=0;for(let j=0;j<4;j++){const w=num(sw,t+j);if(w==0)continue;const m=virtual+usize(ix(si,t+j))*128,bw=1/(num(m,3)*x+num(m,7)*y+num(m,11)*z+num(m,15));px+=(num(m,0)*x+num(m,4)*y+num(m,8)*z+num(m,12))*bw*w;py+=(num(m,1)*x+num(m,5)*y+num(m,9)*z+num(m,13))*bw*w;pz+=(num(m,2)*x+num(m,6)*y+num(m,10)*z+num(m,14))*bw*w;}put(out,k,num(out,k)+(px-num(out,k))*f);put(out,k+1,num(out,k+1)+(py-num(out,k+1))*f);put(out,k+2,num(out,k+2)+(pz-num(out,k+2))*f);}
 }
}
export function clothFinish(count:i32,n:i32,ids:usize,posed:usize,posedN:usize,pos:usize,normal:usize,si:usize,sw:usize,actual:usize,exact:usize,bind:usize,unbind:usize,bodyToCloth:usize,normalToCloth:usize,morphCount:i32,mp:usize,mn:usize,mw:usize,activation:f64):i32{
 for(let h=0;h<count;h++){
  const i=ix(ids,h),k=i*3,t=i*4;let x=num(posed,k),y=num(posed,k+1),z=num(posed,k+2),w=1/(num(bodyToCloth,3)*x+num(bodyToCloth,7)*y+num(bodyToCloth,11)*z+num(bodyToCloth,15)),px=(num(bodyToCloth,0)*x+num(bodyToCloth,4)*y+num(bodyToCloth,8)*z+num(bodyToCloth,12))*w,py=(num(bodyToCloth,1)*x+num(bodyToCloth,5)*y+num(bodyToCloth,9)*z+num(bodyToCloth,13))*w,pz=(num(bodyToCloth,2)*x+num(bodyToCloth,6)*y+num(bodyToCloth,10)*z+num(bodyToCloth,14))*w;
  x=num(posedN,k);y=num(posedN,k+1);z=num(posedN,k+2);let nx=num(normalToCloth,0)*x+num(normalToCloth,3)*y+num(normalToCloth,6)*z,ny=num(normalToCloth,1)*x+num(normalToCloth,4)*y+num(normalToCloth,7)*z,nz=num(normalToCloth,2)*x+num(normalToCloth,5)*y+num(normalToCloth,8)*z,len=Math.sqrt(nx*nx+ny*ny+nz*nz);if(len==0)len=1;nx/=len;ny/=len;nz/=len;
  let a:f64=0,b:f64=0,c:f64=0,d:f64=0,e:f64=0,f:f64=0,g:f64=0,h1:f64=0,j:f64=0,tx:f64=0,ty:f64=0,tz:f64=0,scale:f64=0;
  for(let s=0;s<4;s++){const w=num(sw,t+s),m=actual+usize(ix(si,t+s))*128;a+=w*num(m,0);b+=w*num(m,4);c+=w*num(m,8);d+=w*num(m,1);e+=w*num(m,5);f+=w*num(m,9);g+=w*num(m,2);h1+=w*num(m,6);j+=w*num(m,10);tx+=w*num(m,12);ty+=w*num(m,13);tz+=w*num(m,14);scale+=w*num(m,15);}
  if(activation<1){
   let dx:f64=0,dy:f64=0,dz:f64=0;for(let m=0;m<morphCount;m++){const w=num(mw,m);if(w==0)continue;const p=m*n*3+k;dx+=w*num(mp,p);dy+=w*num(mp,p+1);dz+=w*num(mp,p+2);}x=num(pos,k)+dx;y=num(pos,k+1)+dy;z=num(pos,k+2)+dz;const bw=1/(num(bind,3)*x+num(bind,7)*y+num(bind,11)*z+num(bind,15)),bx=(num(bind,0)*x+num(bind,4)*y+num(bind,8)*z+num(bind,12))*bw,by=(num(bind,1)*x+num(bind,5)*y+num(bind,9)*z+num(bind,13))*bw,bz=(num(bind,2)*x+num(bind,6)*y+num(bind,10)*z+num(bind,14))*bw;let ax:f64=0,ay:f64=0,az:f64=0;
   for(let s=0;s<4;s++){const w=num(sw,t+s);if(w==0)continue;const m=exact+usize(ix(si,t+s))*128,ew=1/(num(m,3)*bx+num(m,7)*by+num(m,11)*bz+num(m,15));ax+=(num(m,0)*bx+num(m,4)*by+num(m,8)*bz+num(m,12))*ew*w;ay+=(num(m,1)*bx+num(m,5)*by+num(m,9)*bz+num(m,13))*ew*w;az+=(num(m,2)*bx+num(m,6)*by+num(m,10)*bz+num(m,14))*ew*w;}
   const uw=1/(num(unbind,3)*ax+num(unbind,7)*ay+num(unbind,11)*az+num(unbind,15)),ox=(num(unbind,0)*ax+num(unbind,4)*ay+num(unbind,8)*az+num(unbind,12))*uw,oy=(num(unbind,1)*ax+num(unbind,5)*ay+num(unbind,9)*az+num(unbind,13))*uw,oz=(num(unbind,2)*ax+num(unbind,6)*ay+num(unbind,10)*az+num(unbind,14))*uw;px+=(ox-px)*(1-activation);py+=(oy-py)*(1-activation);pz+=(oz-pz)*(1-activation);
  }
  const A=e*j-f*h1,B=c*h1-b*j,C=b*f-c*e,D=f*g-d*j,E=a*j-c*g,F=c*d-a*f,G=d*h1-e*g,H=b*g-a*h1,I=a*e-b*d,det=a*A+b*D+c*G;if(Math.abs(det)<1e-12)return 0;
  x=px*scale-tx;y=py*scale-ty;z=pz*scale-tz;px=(A*x+B*y+C*z)/det;py=(D*x+E*y+F*z)/det;pz=(G*x+H*y+I*z)/det;x=(A*nx+B*ny+C*nz)/det;y=(D*nx+E*ny+F*nz)/det;z=(G*nx+H*ny+I*nz)/det;len=Math.sqrt(x*x+y*y+z*z);if(len==0)len=1;nx=x/len;ny=y/len;nz=z/len;
  for(let m=0;m<morphCount;m++){const w=num(mw,m);if(w==0)continue;const p=m*n*3+k;px+=num(mp,p)*-w;py+=num(mp,p+1)*-w;pz+=num(mp,p+2)*-w;nx+=num(mn,p)*-w;ny+=num(mn,p+1)*-w;nz+=num(mn,p+2)*-w;}
  put(pos,k,px);put(pos,k+1,py);put(pos,k+2,pz);put(normal,k,nx);put(normal,k+1,ny);put(normal,k+2,nz);
 }
 return 1;
}

@inline function boxDistance(bounds:usize,i:i32,x:f64,y:f64,z:f64):f64{const k=i*6,dx=Math.max(Math.max(num(bounds,k)-x,0),x-num(bounds,k+3)),dy=Math.max(Math.max(num(bounds,k+1)-y,0),y-num(bounds,k+4)),dz=Math.max(Math.max(num(bounds,k+2)-z,0),z-num(bounds,k+5));return dx*dx+dy*dy+dz*dz;}
function triangleNearest(P:usize,F:usize,x:f64,y:f64,z:f64,j:i32,nearest:usize):void{
 const a=ix(F,j)*3,b=ix(F,j+1)*3,c=ix(F,j+2)*3,ax=num(P,a),ay=num(P,a+1),az=num(P,a+2),bx=num(P,b),by=num(P,b+1),bz=num(P,b+2),cx=num(P,c),cy=num(P,c+1),cz=num(P,c+2),abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=x-ax,apy=y-ay,apz=z-az,d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;let v:f64=0,w:f64=0;
 if(!(d1<=0&&d2<=0)){const bpx=x-bx,bpy=y-by,bpz=z-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;if(d3>=0&&d4<=d3)v=1;else{const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)v=d1/(d1-d3);else{const cpx=x-cx,cpy=y-cy,cpz=z-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;if(d6>=0&&d5<=d6)w=1;else{const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)w=d2/(d2-d6);else{const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){w=(d4-d3)/((d4-d3)+(d5-d6));v=1-w}else{const denom=1/(va+vb+vc);v=vb*denom;w=vc*denom;}}}}}}
 const dx=x-(ax+abx*v+acx*w),dy=y-(ay+aby*v+acy*w),dz=z-(az+abz*v+acz*w);put(nearest,0,v);put(nearest,1,w);put(nearest,2,dx*dx+dy*dy+dz*dz);
}
export function surfaceConstraints(count:i32,ids:usize,P:usize,N:usize,F:usize,nodes:usize,bounds:usize,stack:usize,nearest:usize,radius:f64,out:usize):i32{
 let found=0;
 for(let probe=0;probe<count;probe++){
  const k=ix(ids,probe)*3,x=num(P,k),y=num(P,k+1),z=num(P,k+2);let best=radius*radius,hit:i32=-1,hv:f64=0,hw:f64=0,top:i32=1;store<i32>(stack,0);
  while(top){top--;const id=ix(stack,top);if(boxDistance(bounds,id,x,y,z)>best)continue;const start=ix(nodes,id*4+2),count=ix(nodes,id*4+3);
   if(count>0){for(let j=start*3;j<(start+count)*3;j+=3){triangleNearest(P,F,x,y,z,j,nearest);if(num(nearest,2)<best){best=num(nearest,2);hit=j;hv=num(nearest,0);hw=num(nearest,1);}}}
   else{const left=ix(nodes,id*4),right=ix(nodes,id*4+1),dl=boxDistance(bounds,left,x,y,z),dr=boxDistance(bounds,right,x,y,z);store<i32>(stack+usize(top)*4,dl<dr?right:left);top++;store<i32>(stack+usize(top)*4,dl<dr?left:right);top++;}
  }
  if(hit<0)continue;const a=ix(F,hit)*3,b=ix(F,hit+1)*3,c=ix(F,hit+2)*3,u=1-hv-hw;let nx=u*num(N,a)+hv*num(N,b)+hw*num(N,c),ny=u*num(N,a+1)+hv*num(N,b+1)+hw*num(N,c+1),nz=u*num(N,a+2)+hv*num(N,b+2)+hw*num(N,c+2),len=Math.sqrt(nx*nx+ny*ny+nz*nz);if(len==0)len=1;nx/=len;ny/=len;nz/=len;
  const distance=(x-(num(P,a)*u+num(P,b)*hv+num(P,c)*hw))*nx+(y-(num(P,a+1)*u+num(P,b+1)*hv+num(P,c+1)*hw))*ny+(z-(num(P,a+2)*u+num(P,b+2)*hv+num(P,c+2)*hw))*nz;
  if(distance<-.000001&&num(N,k)*nx+num(N,k+1)*ny+num(N,k+2)*nz<-.15){put(out,found*4,nx);put(out,found*4+1,ny);put(out,found*4+2,nz);put(out,found*4+3,-distance);found++;}
 }
 return found;
}
