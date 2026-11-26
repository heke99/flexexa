export const privacyVersion="applications-2026-11-02-v1";
export function validateApplication(data: Record<string,unknown>){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Kontrollera formuläret.");
 const clean=(key:string,min:number,max:number)=>{
  const raw=data[key];
  if(typeof raw!=="string")throw Error("Kontrollera alla fält.");
  const trimmed=raw.trim();
  const value=key==="email"?trimmed:trimmed.normalize("NFC");
  if(value.length<min||value.length>max||/[\p{Cc}\p{Cs}]/u.test(value))throw Error("Kontrollera alla fält.");
  return value;
 };
 const email=clean("email",3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Ange en giltig mejladress.");
 const rawMiles=typeof data.annual_miles==="string"?data.annual_miles.trim():data.annual_miles;
 const miles=Number(rawMiles);if((typeof rawMiles!=="number"&&(typeof rawMiles!=="string"||!/^\d+$/.test(rawMiles)))||!Number.isInteger(miles)||miles<0||miles>100000)throw Error("Ange körsträckan i mil per år.");
 if(data.privacy_ack!==true||data.privacy_version!==privacyVersion)throw Error("Läs integritetsinformationen innan du skickar ansökan.");
 if(data.website)throw Error("Ansökan kunde inte behandlas.");
 return {email,first_name:clean("first_name",1,100),last_name:clean("last_name",1,100),car:clean("car",2,180),annual_miles:miles,privacy_version:privacyVersion,marketing_consent:data.marketing_consent===true};
}
