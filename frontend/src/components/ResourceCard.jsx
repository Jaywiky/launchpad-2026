function ResourceCard({name, type, notes, extended}) {
    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>{name}</h1>
      <h2>{type}</h2>
      <p>{notes}</p>
      {extended.referral_required && <p>⚠️ Referral Required</p>}
      {extended.accessible && <p>♿ Wheelchair Accessible</p>}
    </div>
    )
}

export default ResourceCard;