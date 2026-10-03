// The same bounded pivot serves street walking and indoor furniture approaches.
export function turnPet(heading,desired,dt){const delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));return {heading:heading+Math.max(-3*dt,Math.min(3*dt,delta)),canMove:Math.abs(delta)<.3};}
