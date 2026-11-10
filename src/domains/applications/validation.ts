export const privacyVersion="applications-2026-11-02-v1";
export function validateApplication(data: Record<string,unknown>){
 if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Kontrollera formuläret.");
 const clean=(key:string,min:number,max:number)=>{if(typeof data[key]!=="string")throw Error("Kontrollera alla fält.");const v=(data[key] as string).trim();if(v.length<min||v.length>max||/[\r\n\u0000-\u001f]/u.test(v))throw Error("Kontrollera alla fält.");return v;};
 const email=clean("email",3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error("Ange en giltig mejladress.");
 const miles=Number(data.annual_miles);if(!["string","number"].includes(typeof data.annual_miles)||data.annual_miles===""||!Number.isInteger(miles)||miles<0||miles>100000)throw Error("Ange körsträckan i mil per år.");
 if(data.privacy_ack!==true||data.privacy_version!==privacyVersion)throw Error("Läs integritetsinformationen innan du skickar ansökan.");
 if(data.website)throw Error("Ansökan kunde inte behandlas.");
 return {email,first_name:clean("first_name",1,100),last_name:clean("last_name",1,100),car:clean("car",2,180),annual_miles:miles,privacy_version:privacyVersion,marketing_consent:data.marketing_consent===true};
}
